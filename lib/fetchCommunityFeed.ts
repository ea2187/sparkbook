// lib/fetchCommunityFeed.ts
import { supabase } from "./supabase";

export type CommunityAttachment = {
  id: string;
  post_id: string;
  spark_id: string | null;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  spotify_url: string | null;
  audio_url: string | null;
  media_type: "image" | "music" | "spark" | "note" | "audio" | null;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  type: "image" | "music" | "sparklette" | "note" | "audio";
  caption: string | null;
  created_at: string;
  attachments: CommunityAttachment[];
};

export async function fetchCommunityFeed(): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from("community_posts")
    .select(
      `
      id,
      user_id,
      type,
      caption,
      created_at,
      attachments:community_attachments(
        id,
        post_id,
        spark_id,
        title,
        subtitle,
        image_url,
        spotify_url,
        audio_url,
        media_type,
        created_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching community feed:", error);
    return [];
  }

  return (data as CommunityPost[]) || [];
}
