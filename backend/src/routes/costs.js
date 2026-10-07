import { Router } from 'express'
import * as cost from '../cost.service.js'
import { buildCostExportCsv } from '../costExport.service.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// Aggregated cost overview for the dashboard: KPIs, 30-day series, per-service
// breakdown and per-account sync state.
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json({ overview: await cost.getCostOverview(req.user.sub) })
  }),
)

// Full billing export: per-service summary + every stored daily row as a
// downloadable CSV file.
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { filename, csv } = await buildCostExportCsv(req.user.sub)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  }),
)

export default router
