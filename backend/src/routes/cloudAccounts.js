import { Router } from 'express'
import * as cloud from '../cloud.service.js'
import * as cost from '../cost.service.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// Every route below requires a verified, signed-in session.
router.use(requireAuth)

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    res.json({ providers: cloud.listProviders() })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await cloud.listCloudAccounts(req.user.sub)
    res.json({ accounts, count: accounts.length })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = cloud.parseCloudAccount(req.body)
    const account = await cloud.addCloudAccount(req.user.sub, input)
    res.status(201).json({ account })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ account: await cloud.getCloudAccount(req.user.sub, req.params.id) })
  }),
)

// Triggers a cost ingestion run for one account and moves it pending ->
// connected. Safe to call repeatedly — each run replaces the previous data.
router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    res.json(await cost.syncCloudAccount(req.user.sub, req.params.id))
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await cloud.deleteCloudAccount(req.user.sub, req.params.id)
    res.status(204).end()
  }),
)

export default router
