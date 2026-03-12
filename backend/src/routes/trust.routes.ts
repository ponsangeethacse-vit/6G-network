import { Router } from 'express';
import { trustFusionService } from '../services/trust-fusion.service';
import { roleIdentificationService } from '../services/role-identification.service';

const router = Router();

router.get('/nodes', (req, res) => {
  const nodes = roleIdentificationService.getActiveNodes();
  res.json({ nodes });
});

router.get('/trust/:address', (req, res) => {
  const address = req.params.address;
  const history = trustFusionService.getHistoricalTrust(address);
  const prediction = trustFusionService.getPredictedFutureTrust(address);

  res.json({
    node: address,
    history,
    currentScore: history.length > 0 ? history[history.length - 1] : 100,
    predictedNextScore: prediction
  });
});

export const trustRoutes = router;
