// src/controllers/dashboardController.js
import User from "../../models/User.js";
import Appointment from "../../models/Appointment.js";
import Treatment from "../../models/Treatment.js";


function startOfUTC(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function nextDayUTC(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

// GET /api/dashboard/summary
export const getDashboardSummary = async (req, res) => {
  try {
    const todayStart = startOfUTC();
    const tomorrowStart = nextDayUTC();

    const [
      totalPatients,
      totalAppointments,
      upcomingAppointments,
      todayAppointments,
      activeTreatments,
      completedTreatments,
    ] = await Promise.all([
      User.countDocuments({ role: "patient" }),
      Appointment.countDocuments({}),
      // القادم: أي موعد تاريخُه >= غدًا
      Appointment.countDocuments({ date: { $gte: tomorrowStart } }),
      // اليوم: بين بداية اليوم ونهايته
      Appointment.countDocuments({ date: { $gte: todayStart, $lt: tomorrowStart } }),
      Treatment.countDocuments({ status: "in_progress" }),
      Treatment.countDocuments({ status: "completed" }),
    ]);

    res.status(200).json({
      totalPatients,
      totalAppointments,
      upcomingAppointments,
      todayAppointments,
      activeTreatments,
      completedTreatments,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dashboard stats", error: err.message });
  }
};

// GET /api/dashboard/calendar
export const getUpcomingAppointmentsForCalendar = async (req, res) => {
  try {
    const todayStart = startOfUTC();

    const appointments = await Appointment.find({
      date: { $gte: todayStart },
      status: { $ne: "cancelled" },
    })
      .populate({ path: "userId", select: "name" }) // بدل include
      .sort({ date: 1, time: 1 })   
      .lean();

    const result = appointments.map((app) => ({
      id: app._id,
      title: app.userId?.name || "—",
      date: app.date,  
      time: app.time, 
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch calendar appointments",
      error: err.message,
    });
  }
};
