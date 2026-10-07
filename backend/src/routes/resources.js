import { Router } from 'express'
import { getResourceInventory } from '../resources.service.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// Live inventory of the user's AWS resources — fetched from the provider on
// every request so the list always reflects current state.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getResourceInventory(req.user.sub))
  }),
)

export default router
