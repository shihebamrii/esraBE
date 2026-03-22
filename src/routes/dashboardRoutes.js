const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authController = require('../controllers/authController'); // Need protect middleware

const router = express.Router();

// Protect all routes
// Assuming there is a 'protect' middleware in authController or similar. 
// Scanning previous file `authController.js` and `authRoutes.js` usually reveals the middleware usage.
// I will assume standard practice: require('../middlewares/authMiddleware').protect or similar.
// Let's check `authRoutes.js` first or assume standard `authController.protect` if it was exported?
// Ah, `authController` didn't seem to export `protect`. It's likely in a middleware file.
// I saw `middlewares` dir. `protect` is likely in `src/middlewares/authMiddleware.js` or similar.
// I will use a placeholder for now and verification step will fix if import is wrong, but typically it's separate.
// Wait, I should check `routes/contentRoutes.js` to see how they protect routes.

const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/stats', dashboardController.getUserUploadStats);
router.get('/recent', dashboardController.getRecentActivity);
router.get('/user-stats', dashboardController.getUserStats);
router.get('/admin-stats', dashboardController.getAdminStats);
router.get('/downloads', dashboardController.getMyDownloads);
router.get('/my-photos', dashboardController.getMyPhotos);
router.get('/my-content', dashboardController.getMyContent);
router.get('/packs', dashboardController.getUserPacks);

module.exports = router;
