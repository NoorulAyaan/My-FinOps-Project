import { listCloudAccounts, readSecretForProvider } from './cloud.service.js'

/**
 * Live AWS resource inventory. Queries the provider with the stored
 * credentials on every request — nothing is cached, so the list always
 * reflects the account's current state.
 *
 * Sweep: EC2 + Lambda + RDS across every enabled region (parallel), plus
 * S3 buckets globally. Regions come from ec2:DescribeRegions; if that call
 * is denied we fall back to the connection's configured region.
 */

const FALLBACK_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
]

// Bucket locations older than 2019 use the legacy 'EU' constraint.
const LEGACY_LOCATIONS = { EU: 'eu-west-1' }

function collectError(errors, api, err) {
  const name = err?.name ?? 'Error'
  const key = `${api}:${name}`
  const existing = errors.find((e) => e.key === key)
  if (existing) existing.affected += 1
  else errors.push({ key, api, name, message: err?.message ?? String(err), affected: 1 })
}

/**
 * Clients are cached per service/region/credential so repeat sweeps reuse
 * warm connections instead of paying DNS + TLS for ~50 endpoints again.
 */
const clientCache = new Map()

function credKey(credentials) {
  const s = credentials.accessKeyId + '|' + credentials.secretAccessKey
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function getClient(ClientClass, service, region, credentials) {
  const key = `${service}:${region}:${credKey(credentials)}`
  let client = clientCache.get(key)
  if (!client) {
    client = new ClientClass({ region, credentials, maxAttempts: 2 })
    clientCache.set(key, client)
  }
  return client
}

async function fetchRegions(client, errors) {
  try {
    const { DescribeRegionsCommand } = await import('@aws-sdk/client-ec2')
    const res = await client.send(new DescribeRegionsCommand({ AllRegions: false }))
    return res.Regions?.map((r) => r.RegionName).filter(Boolean) ?? FALLBACK_REGIONS
  } catch (err) {
    collectError(errors, 'ec2:DescribeRegions', err)
    return FALLBACK_REGIONS
  }
}

async function fetchEc2Instances(regions, credentials, errors) {
  const { EC2Client, DescribeInstancesCommand } = await import('@aws-sdk/client-ec2')
  const resources = []
  await Promise.all(
    regions.map(async (region) => {
      try {
        const client = getClient(EC2Client, 'ec2', region, credentials)
        const res = await client.send(
          new DescribeInstancesCommand({
            Filters: [
              {
                Name: 'instance-state-name',
                Values: ['pending', 'running', 'stopped', 'stopping', 'shutting-down', 'rebooting'],
              },
            ],
          }),
        )
        for (const reservation of res.Reservations ?? []) {
          for (const inst of reservation.Instances ?? []) {
            const name = inst.Tags?.find((t) => t.Key === 'Name')?.Value
            resources.push({
              type: 'EC2',
              id: inst.InstanceId,
              name: name || inst.InstanceId,
              region,
              state: inst.State?.Name ?? 'unknown',
              detail: `${inst.InstanceType} · ${inst.Placement?.AvailabilityZone ?? region}`,
            })
          }
        }
      } catch (err) {
        collectError(errors, 'ec2:DescribeInstances', err)
      }
    }),
  )
  return resources
}

async function fetchLambdaFunctions(regions, credentials, errors) {
  const { LambdaClient, ListFunctionsCommand } = await import('@aws-sdk/client-lambda')
  const resources = []
  await Promise.all(
    regions.map(async (region) => {
      try {
        const client = getClient(LambdaClient, 'lambda', region, credentials)
        const res = await client.send(new ListFunctionsCommand({ MaxItems: 50 }))
        for (const fn of res.Functions ?? []) {
          resources.push({
            type: 'Lambda',
            id: fn.FunctionName,
            name: fn.FunctionName,
            region,
            state: fn.State ?? 'Active',
            detail: `${fn.Runtime ?? '—'} · ${fn.MemorySize ?? '—'}MB`,
          })
        }
      } catch (err) {
        collectError(errors, 'lambda:ListFunctions', err)
      }
    }),
  )
  return resources
}

async function fetchRdsInstances(regions, credentials, errors) {
  const { RDSClient, DescribeDBInstancesCommand } = await import('@aws-sdk/client-rds')
  const resources = []
  await Promise.all(
    regions.map(async (region) => {
      try {
        const client = getClient(RDSClient, 'rds', region, credentials)
        const res = await client.send(new DescribeDBInstancesCommand({}))
        for (const db of res.DBInstances ?? []) {
          resources.push({
            type: 'RDS',
            id: db.DBInstanceIdentifier,
            name: db.DBInstanceIdentifier,
            region,
            state: db.DBInstanceStatus ?? 'unknown',
            detail: `${db.DBInstanceClass} · ${db.Engine} ${db.EngineVersion}`,
          })
        }
      } catch (err) {
        collectError(errors, 'rds:DescribeDBInstances', err)
      }
    }),
  )
  return resources
}

async function fetchS3Buckets(credentials, errors) {
  const { S3Client, ListBucketsCommand, GetBucketLocationCommand } = await import(
    '@aws-sdk/client-s3'
  )
  const resources = []
  try {
    const client = getClient(S3Client, 's3', 'us-east-1', credentials)
    const res = await client.send(new ListBucketsCommand({}))
    for (const bucket of res.Buckets ?? []) {
      let region = 'us-east-1'
      try {
        const loc = await client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }))
        region = LEGACY_LOCATIONS[loc.LocationConstraint] ?? loc.LocationConstraint ?? 'us-east-1'
      } catch {
        // Location is cosmetic — keep the bucket even if its region lookup fails.
      }
      resources.push({
        type: 'S3',
        id: bucket.Name,
        name: bucket.Name,
        region,
        state: 'available',
        detail: bucket.CreationDate
          ? `created ${bucket.CreationDate.toISOString().slice(0, 10)}`
          : 'bucket',
      })
    }
  } catch (err) {
    collectError(errors, 's3:ListAllMyBuckets', err)
  }
  return resources
}

/**
 * Builds the full live inventory for every AWS connection the user has.
 * Partial failures are surfaced in `errors` rather than failing the request,
 * so one denied region or API still yields the rest of the picture.
 */
export async function getResourceInventory(userId) {
  const accounts = (await listCloudAccounts(userId)).filter((a) => a.provider === 'aws')
  const resources = []
  const errors = []

  for (const account of accounts) {
    let credentials
    try {
      credentials = {
        accessKeyId: account.accessKeyId,
        secretAccessKey: await readSecretForProvider(userId, account.id),
      }
    } catch (err) {
      collectError(errors, 'credentials', err)
      continue
    }

    const { EC2Client } = await import('@aws-sdk/client-ec2')
    const regions = await fetchRegions(
      getClient(EC2Client, 'ec2', account.region || 'us-east-1', credentials),
      errors,
    )

    const [ec2, lambda, rds, s3] = await Promise.all([
      fetchEc2Instances(regions, credentials, errors),
      fetchLambdaFunctions(regions, credentials, errors),
      fetchRdsInstances(regions, credentials, errors),
      fetchS3Buckets(credentials, errors),
    ])
    for (const r of [...ec2, ...lambda, ...rds, ...s3]) {
      r.account = account.label
      resources.push(r)
    }
  }

  const byType = {}
  const byRegion = {}
  const byState = {}
  for (const r of resources) {
    byType[r.type] = (byType[r.type] ?? 0) + 1
    byRegion[r.region] = (byRegion[r.region] ?? 0) + 1
    byState[r.state] = (byState[r.state] ?? 0) + 1
  }

  return {
    resources,
    summary: {
      total: resources.length,
      accounts: accounts.length,
      regions: Object.keys(byRegion).length,
      byType,
      byRegion,
      byState,
    },
    errors: errors.map(({ key, ...e }) => e),
    fetchedAt: new Date().toISOString(),
  }
}
