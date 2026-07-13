import { Router, type IRouter } from "express";
import healthRouter from './health.js';
import authRouter from './auth.js';
import companiesRouter from './companies.js';
import usersRouter from './users.js';
import productsRouter from './products.js';
import locationsRouter from './locations.js';
import batchesRouter from './batches.js';
import codesRouter from './codes.js';
import reportsRouter from './reports.js';
import uploadRouter from './upload.js';
import subscriptionRouter from './subscription.js';
import systemRouter from './system.js';

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(usersRouter);
router.use(productsRouter);
router.use(locationsRouter);
router.use(batchesRouter);
router.use(codesRouter);
router.use(reportsRouter);
router.use(uploadRouter);
router.use(subscriptionRouter);
router.use(systemRouter);

export default router;
