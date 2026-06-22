import { Router } from "express";
import { GarminConnect } from "garmin-connect";

const router = Router();

router.post("/garmin-test/fetch", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const gc = new GarminConnect({ username, password });

  try {
    await gc.login();
  } catch (err: any) {
    return res.status(401).json({ error: "Login failed: " + (err?.message ?? String(err)) });
  }

  try {
    const [profile, settings, activities, steps, heartRate] = await Promise.allSettled([
      gc.getUserProfile(),
      gc.getUserSettings(),
      gc.getActivities(0, 10),
      gc.getSteps(new Date()),
      gc.getHeartRate(new Date()),
    ]);

    return res.json({
      profile:    profile.status    === "fulfilled" ? profile.value    : null,
      settings:   settings.status   === "fulfilled" ? settings.value   : null,
      activities: activities.status === "fulfilled" ? activities.value : [],
      steps:      steps.status      === "fulfilled" ? steps.value      : null,
      heartRate:  heartRate.status  === "fulfilled" ? heartRate.value  : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Data fetch failed: " + (err?.message ?? String(err)) });
  }
});

export default router;
