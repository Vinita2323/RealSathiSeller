import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import * as customer from '../controllers/repairCustomerController.js';
import * as captain from '../controllers/repairCaptainController.js';
import * as admin from '../controllers/repairAdminController.js';
import * as tech from '../controllers/repairTechnicianController.js';

// Repair & Services module — mounted at /api/repair. Isolated from ecommerce orders.
const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────────────────
router.get('/catalog', customer.getCatalog);
router.post('/technician/login', tech.technicianLogin);

// ── Customer ─────────────────────────────────────────────────────────────────────────
const customerAuth = protect('user');
router.post('/bookings', customerAuth, customer.createBooking);
router.get('/bookings', customerAuth, customer.getMyBookings);
router.get('/bookings/:id', customerAuth, customer.getMyBooking);
router.put('/bookings/:id/quotation', customerAuth, customer.respondToQuotation);
router.put('/bookings/:id/cancel', customerAuth, customer.cancelMyBooking);

// ── Captain (rider) ──────────────────────────────────────────────────────────────────
const captainAuth = protect('captain');
router.get('/captain/pending', captainAuth, captain.getPendingOffers);
router.get('/captain/jobs', captainAuth, captain.getCaptainJobs);
router.put('/captain/jobs/:id/accept', captainAuth, captain.acceptJob);
router.put('/captain/jobs/:id/reject', captainAuth, captain.rejectJob);
router.put('/captain/jobs/:id/start-ride', captainAuth, captain.startPickupRide);
router.put('/captain/jobs/:id/reached', captainAuth, captain.markReachedCustomer);
router.post('/captain/jobs/:id/verify-pickup-otp', captainAuth, captain.verifyPickupOtp);
router.put('/captain/jobs/:id/start-center-ride', captainAuth, captain.startRideToCenter);
router.put('/captain/jobs/:id/reached-center', captainAuth, captain.markReachedCenter);
router.post('/captain/jobs/:id/verify-center-otp', captainAuth, captain.verifyCenterOtp);
router.put('/captain/jobs/:id/collect', captainAuth, captain.collectFromCenter);
router.post('/captain/jobs/:id/verify-delivery-otp', captainAuth, captain.verifyDeliveryOtp);

// ── Technician ───────────────────────────────────────────────────────────────────────
const techAuth = protect('technician');
router.get('/technician/me', techAuth, tech.getTechnicianProfile);
router.get('/technician/jobs', techAuth, tech.getTechnicianJobs);
router.get('/technician/jobs/:id', techAuth, tech.getTechnicianJob);
router.put('/technician/jobs/:id/quotation', techAuth, tech.submitDiagnosisAndQuotation);
router.put('/technician/jobs/:id/start-repair', techAuth, tech.startRepair);
router.put('/technician/jobs/:id/complete', techAuth, tech.completeRepair);

// ── Admin ────────────────────────────────────────────────────────────────────────────
const adminAuth = protect('admin', 'super_admin');
router.get('/admin/new-requests', adminAuth, admin.getNewRequests);
router.get('/admin/bookings', adminAuth, admin.listBookings);
router.get('/admin/bookings/:id', adminAuth, admin.getBooking);
router.put('/admin/bookings/:id/assign-pickup', adminAuth, admin.assignPickupRider);
router.put('/admin/bookings/:id/assign-delivery', adminAuth, admin.assignDeliveryRider);
router.put('/admin/bookings/:id/assign-center', adminAuth, admin.assignCenter);
router.put('/admin/bookings/:id/assign-technician', adminAuth, admin.assignTechnician);
router.put('/admin/bookings/:id/start-diagnosis', adminAuth, admin.startDiagnosis);
router.put('/admin/bookings/:id/diagnosis', adminAuth, admin.saveDiagnosis);
router.put('/admin/bookings/:id/customer-decision', adminAuth, admin.recordCustomerDecision);
router.put('/admin/bookings/:id/start-repair', adminAuth, admin.startRepairByAdmin);
router.put('/admin/bookings/:id/complete-repair', adminAuth, admin.completeRepairByAdmin);
router.put('/admin/bookings/:id/cancel', adminAuth, admin.cancelBooking);
router.get('/admin/riders', adminAuth, admin.listRiders);

router.get('/admin/drivers', adminAuth, admin.listDrivers);
router.post('/admin/drivers', adminAuth, admin.createDriver);
router.put('/admin/drivers/:id', adminAuth, admin.updateDriver);
router.delete('/admin/drivers/:id', adminAuth, admin.deleteDriver);

router.get('/admin/technicians', adminAuth, admin.listTechnicians);
router.post('/admin/technicians', adminAuth, admin.createTechnician);
router.put('/admin/technicians/:id', adminAuth, admin.updateTechnician);
router.delete('/admin/technicians/:id', adminAuth, admin.deleteTechnician);

router.get('/admin/centers', adminAuth, admin.listCenters);
router.post('/admin/centers', adminAuth, admin.createCenter);
router.put('/admin/centers/:id', adminAuth, admin.updateCenter);
router.delete('/admin/centers/:id', adminAuth, admin.deleteCenter);

router.get('/admin/categories', adminAuth, admin.listCategories);
router.post('/admin/categories', adminAuth, admin.createCategory);
router.put('/admin/categories/:id', adminAuth, admin.updateCategory);
router.delete('/admin/categories/:id', adminAuth, admin.deleteCategory);

router.get('/admin/content', adminAuth, admin.getContent);
router.put('/admin/content', adminAuth, admin.updateContent);

router.get('/admin/reports/summary', adminAuth, admin.getReportSummary);

export default router;
