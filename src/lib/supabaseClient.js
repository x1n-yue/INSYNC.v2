import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "./config";

const initialized = createBrowserClient(import.meta.env, createClient);
export const supabase = initialized.client;
export const setupError = initialized.error;
