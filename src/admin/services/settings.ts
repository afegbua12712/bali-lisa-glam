import { supabase } from "@/lib/supabase";

export async function getWebsiteSettings() {
  const { data, error } = await supabase
    .from("website_settings")
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function getPaymentSettings() {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("*")
    .single();

  if (error) throw error;

  return data;
}