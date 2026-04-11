const { Inquiry } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Submit a new contact inquiry
 * @route   POST /api/inquiries
 * @access  Public
 */
const submitInquiry = asyncHandler(async (req, res, next) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return next(new AppError('Please provide all required fields', 400));
  }

  const inquiry = await Inquiry.create({
    name,
    email,
    subject,
    message,
  });

  res.status(201).json({
    status: 'success',
    message: 'Inquiry submitted successfully',
    data: { inquiry },
  });
});

/**
 * @desc    Get all inquiries (Admin)
 * @route   GET /api/admin/inquiries
 * @access  Private (Admin)
 */
const getAllInquiries = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;

  const total = await Inquiry.countDocuments(query);
  const inquiries = await Inquiry.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    results: inquiries.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { inquiries },
  });
});

/**
 * @desc    Update inquiry status/notes (Admin)
 * @route   PATCH /api/admin/inquiries/:id
 * @access  Private (Admin)
 */
const updateInquiry = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  const inquiry = await Inquiry.findById(id);

  if (!inquiry) {
    return next(new AppError('Inquiry not found', 404));
  }

  if (status) inquiry.status = status;
  if (adminNotes !== undefined) inquiry.adminNotes = adminNotes;

  await inquiry.save();

  res.status(200).json({
    status: 'success',
    data: { inquiry },
  });
});

/**
 * @desc    Delete an inquiry (Admin)
 * @route   DELETE /api/admin/inquiries/:id
 * @access  Private (Admin)
 */
const deleteInquiry = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const inquiry = await Inquiry.findByIdAndDelete(id);

  if (!inquiry) {
    return next(new AppError('Inquiry not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  submitInquiry,
  getAllInquiries,
  updateInquiry,
  deleteInquiry,
};
