import { supabase } from "@/lib/supabase";

const BUCKET = "farmer-photos";

/** Upload image to Storage and return public URL, or null on failure. */
export async function uploadFarmerPhoto(farmerId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${farmerId}/photo.${safeExt}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
  });

  if (error) {
    console.error("[farmer-photo] upload:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function farmerPhotoBucketName() {
  return BUCKET;
}
