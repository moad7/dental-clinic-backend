import Clinic from '../../models/Clinic.js';

// POST /api/clinic/createClinic
export const createClinic = async (req, res) => {
  try {
    const { name, address, phones = [], description, geo } = req.body;

    // validation
    if (!name?.trim()) {
      return res.status(400).json({
        message: 'Clinic name is required',
      });
    }

    // check if clinic already exists
    const existingClinic = await Clinic.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: 'i',
      },
    });

    if (existingClinic) {
      return res.status(400).json({
        message: 'Clinic already exists',
      });
    }

    // create clinic
    const clinic = await Clinic.create({
      name: name.trim(),
      address,
      phones: Array.isArray(phones) ? phones : [],
      description,
      geo: {
        lat: geo?.lat || null,
        lng: geo?.lng || null,
      },
    });

    return res.status(201).json({
      message: 'Clinic created successfully',
      clinic,
    });
  } catch (error) {
    console.error('createClinic error:', error);

    return res.status(500).json({
      message: 'Failed to create clinic',
      error: error.message,
    });
  }
};
// GET /api/clinic/getAllClinics
export const getAllClinics = async (req, res) => {
  try {
    const clinics = await Clinic.find().sort({ createdAt: -1 });

    return res.status(200).json({
      count: clinics.length,
      clinics,
    });
  } catch (error) {
    console.error('getAllClinics error:', error);

    return res.status(500).json({
      message: 'Failed to fetch clinics',
      error: error.message,
    });
  }
};
