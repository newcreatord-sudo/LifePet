import { useEffect, useState } from "react";
import { subscribeUserProfile, type UserProfile } from "@/data/users";

export function useUserProfile(uid: string | null | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const unsub = subscribeUserProfile(uid, setProfile);
    return () => unsub();
  }, [uid]);

  return profile;
}

