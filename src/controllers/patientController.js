// src/controllers/patientController.js
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Treatment from '../../models/Treatment.js';
import TreatmentSession from '../../models/TreatmentSession.js';
import mongoose from 'mongoose';

export const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find()
      .populate({
        path: 'userId',
        match: { role: 'patient' },
        select: `
          idNumber
          name
          email
          phoneNumber
          gender
          city
          birth
          avatar
          role
          isActive
          mustSetPassword
          activationTokenExpires
          lastSignIn
          createdAt
        `,
      })
      .populate({
        path: 'createdBy',
        select: 'name role phoneNumber',
      })
      .sort({ createdAt: -1 })
      .lean();

    const validPatients = patients.filter(
      (patient) => patient.userId?._id,
    );

    const patientIds = validPatients.map(
      (patient) => patient.userId._id,
    );

    const treatments = await Treatment.find({
      userId: { $in: patientIds },
    })
      .populate({
        path: 'serviceGroupId',
        select: 'title services isArchived',
      })
      .populate({
        path: 'createdBy',
        select: 'name role phoneNumber',
      })
      .populate({
        path: 'Sessions',
        options: {
          sort: { date: -1, time: -1 },
        },
        populate: [
          {
            path: 'doctorId',
            select: 'name phoneNumber avatar',
          },
          {
            path: 'createdBy',
            select: 'name role phoneNumber',
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();


    const treatmentsMap = new Map();
    const lastVisitMap = new Map();

    for (const treatment of treatments) {
      const userId = treatment.userId.toString();

      const serviceGroup = treatment.serviceGroupId;

      const serviceItem = serviceGroup?.services?.find(
        (item) =>
          item._id.toString() ===
          treatment.serviceItemId?.toString(),
      );

      const normalizedTreatment = {
        ...treatment,
        serviceGroupId: serviceGroup
          ? {
              _id: serviceGroup._id,
              title: serviceGroup.title,
              isArchived: serviceGroup.isArchived,
            }
          : null,
        serviceItem: serviceItem || null,
      };

      if (!treatmentsMap.has(userId)) {
        treatmentsMap.set(userId, []);
      }

      treatmentsMap.get(userId).push(normalizedTreatment);

      for (const session of treatment.Sessions || []) {
        if (session.status !== 'completed') continue;
        if (!session.date || !session.time) continue;

        const sessionDate = new Date(session.date);

        if (Number.isNaN(sessionDate.getTime())) continue;

        const dateOnly = sessionDate
          .toISOString()
          .slice(0, 10);

        const visitKey = `${dateOnly}T${session.time}`;

        const previousVisit = lastVisitMap.get(userId);

        if (!previousVisit || visitKey > previousVisit.key) {
          lastVisitMap.set(userId, {
            key: visitKey,
            _id: session._id,
            date: session.date,
            time: session.time,
            doctor: session.doctorId || null,
            serviceName: serviceItem?.name || null,
          });
        }
      }
    }


    const result = validPatients.map((patient) => {
      const userId = patient.userId._id.toString();

      const patientTreatments =
        treatmentsMap.get(userId) || [];

      const sessions = patientTreatments.flatMap(
        (treatment) => treatment.Sessions || [],
      );

      const lastVisit = lastVisitMap.get(userId);

      const stats = {
        totalTreatments: patientTreatments.length,

        activeTreatments: patientTreatments.filter(
          (t) => t.status === 'in_progress',
        ).length,

        completedTreatments: patientTreatments.filter(
          (t) => t.status === 'completed',
        ).length,

        cancelledTreatments: patientTreatments.filter(
          (t) => t.status === 'cancelled',
        ).length,

        rejectedTreatments: patientTreatments.filter(
          (t) => t.status === 'rejected',
        ).length,

        totalSessions: sessions.length,

        pendingSessions: sessions.filter(
          (s) => s.status === 'pending',
        ).length,

        confirmedSessions: sessions.filter(
          (s) => s.status === 'confirmed',
        ).length,

        completedSessions: sessions.filter(
          (s) => s.status === 'completed',
        ).length,

        cancelledSessions: sessions.filter(
          (s) => s.status === 'cancelled',
        ).length,

        rejectedSessions: sessions.filter(
          (s) => s.status === 'rejected',
        ).length,

        expiredSessions: sessions.filter(
          (s) => s.status === 'expired',
        ).length,
      };

      return {
        ...patient,

        lastVisit: lastVisit?.date || null,

        lastVisitDetails: lastVisit
          ? {
              _id: lastVisit._id,
              date: lastVisit.date,
              time: lastVisit.time,
              doctor: lastVisit.doctor,
              serviceName: lastVisit.serviceName,
            }
          : null,

        stats,
        treatments: patientTreatments,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      patients: result,
    });
  } catch (error) {
    console.error('getAllPatients error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch patients',
    });
  }
};

export const getPatientFullProfile = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient id',
      });
    }
    const user = await User.findOne({
      _id: patientId,
      role: 'patient',
    })
      .select(
        'idNumber name email phoneNumber gender birth avatar role isActive mustSetPassword activationTokenExpires createdAt updatedAt',
      )
      .lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Patient user not found',
      });
    }
    const patientProfile = await Patient.findOne({ userId: patientId })
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const treatments = await Treatment.find({ userId: patientId })
      .sort({ createdAt: -1 })
      .populate('serviceGroupId', 'title services')
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const treatmentIds = treatments.map((t) => t._id);
    const sessions = await TreatmentSession.find({
      treatmentId: { $in: treatmentIds },
    })
      .sort({ date: -1, time: -1 })
      .populate('doctorId', 'name phoneNumber role avatar doctor.clinic')
      .populate('createdBy', 'name phoneNumber role')
      .lean();
    const sessionsByTreatmentId = sessions.reduce((acc, session) => {
      const key = session.treatmentId.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    }, {});
    const formattedTreatments = treatments.map((treatment) => {
      const serviceGroup = treatment.serviceGroupId;
      const serviceItem =
        serviceGroup?.services?.find(
          (item) => item._id.toString() === treatment.serviceItemId.toString(),
        ) || null;
      const treatmentSessions =
        sessionsByTreatmentId[treatment._id.toString()] || [];
      const completedSessions = treatmentSessions.filter(
        (s) => s.status === 'completed',
      ).length;
      return {
        _id: treatment._id,
        status: treatment.status,
        totalSessions: treatment.totalSessions,
        completedSessions,
        remainingSessions: Math.max(
          treatment.totalSessions - completedSessions,
          0,
        ),
        note: treatment.note || '',
        createdAt: treatment.createdAt,
        updatedAt: treatment.updatedAt,
        completedAt: treatment.completedAt || null,
        createdByRole: treatment.createdByRole,
        createdBy: treatment.createdBy,
        service: {
          groupId: serviceGroup?._id || null,
          groupTitle: serviceGroup?.title || '',
          itemId: serviceItem?._id || treatment.serviceItemId,
          itemName: serviceItem?.name || '',
          description: serviceItem?.description || '',
          price: serviceItem?.price || 0,
          durationMin: serviceItem?.durationMin || null,
          photo: serviceItem?.photo || '',
        },
        sessions: treatmentSessions.map((session) => ({
          _id: session._id,
          date: session.date,
          time: session.time,
          status: session.status,
          note: session.note || '',
          doctor: session.doctorId,
          createdBy: session.createdBy,
          createdByRole: session.createdByRole,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        })),
      };
    });
    const activeTreatments = formattedTreatments.filter((t) =>
      ['in_progress', 'confirmed', 'pending'].includes(t.status),
    );
    const previousTreatments = formattedTreatments.filter((t) =>
      ['completed', 'cancelled', 'rejected'].includes(t.status),
    );
    const { userId, __v, ...cleanPatientProfile } = patientProfile;
    return res.status(200).json({
      success: true,
      user,
      patientProfile,
      statistics: {
        totalTreatments: formattedTreatments.length,
        activeTreatments: activeTreatments.length,
        previousTreatments: previousTreatments.length,
        completedTreatments: formattedTreatments.filter(
          (t) => t.status === 'completed',
        ).length,
        cancelledTreatments: formattedTreatments.filter(
          (t) => t.status === 'cancelled',
        ).length,
        rejectedTreatments: formattedTreatments.filter(
          (t) => t.status === 'rejected',
        ).length,
        totalSessions: sessions.length,
        completedSessions: sessions.filter((s) => s.status === 'completed')
          .length,
        pendingSessions: sessions.filter((s) => s.status === 'pending').length,
        confirmedSessions: sessions.filter((s) => s.status === 'confirmed')
          .length,
      },
      treatments: {
        active: activeTreatments,
        previous: previousTreatments,
      },
    });
  } catch (error) {
    console.error('getPatientFullProfileForSecretary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get patient full profile',
      error: error.message,
    });
  }
};

export const deletePatientAccount = async (req, res) => {
  let session;
  try {
    const currentUserId = req.user?.userId;
    const role = req.user?.role;
    if (
      role === 'patient' &&
      req.params.userId &&
      req.params.userId !== currentUserId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account',
      });
    }
    const userId =
      role === 'patient'
        ? currentUserId
        : req.params.userId;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID',
      });
    }
    session = await mongoose.startSession();
    let deletedData;
    await session.withTransaction(async () => {
      const user = await User.findOne({
        _id: userId,
        role: 'patient',
      })
        .select('_id name')
        .session(session)
        .lean();

      if (!user) {
        const error = new Error('Patient not found');
        error.statusCode = 404;
        throw error;
      }

      const treatments = await Treatment.find({
        userId: user._id,
      })
        .select('_id')
        .session(session)
        .lean();

      const treatmentIds = treatments.map(
        (treatment) => treatment._id,
      );

      const deletedSessions = await TreatmentSession.deleteMany(
        {
          treatmentId: { $in: treatmentIds },
        },
        { session },
      );

      const deletedTreatments = await Treatment.deleteMany(
        { userId: user._id },
        { session },
      );

      const deletedPatient = await Patient.deleteOne(
        { userId: user._id },
        { session },
      );

      const deletedUser = await User.deleteOne(
        {
          _id: user._id,
          role: 'patient',
        },
        { session },
      );

      if (deletedUser.deletedCount !== 1) {
        throw new Error('Failed to delete patient account');
      }
      deletedData = {
        userId: user._id,
        name: user.name,
        users: deletedUser.deletedCount,
        patientProfiles: deletedPatient.deletedCount,
        treatments: deletedTreatments.deletedCount,
        sessions: deletedSessions.deletedCount,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Patient and all related data deleted successfully',
      deletedData,
    });
  } catch (error) {
    console.error('deletePatientAccount error:', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : 'Failed to delete patient account',
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

