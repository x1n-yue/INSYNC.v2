// Browser-only synthetic transport. Never imported by the application build.
import { supabase as workflows, fixture } from "./synthetic-client";

let listener;
const state = window.__authTest = {
  mode: "invalid", signIns: 0, signUps: 0, metadata: null, email: "",
};
const session = { user: { id: fixture.me.id } };
export const setupError = null;
export const supabase = {
  ...workflows,
  auth: {
    getSession: async () => {
      if (new URLSearchParams(location.search).has("restore-error")) throw new Error("Synthetic session restoration failure");
      return { data: { session: new URLSearchParams(location.search).has("session") ? session : null } };
    },
    onAuthStateChange: callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe() { listener = null; } } } };
    },
    signInWithPassword: async ({ email, password }) => {
      state.signIns++;
      state.email = email;
      if (!password) throw new Error("Missing synthetic input");
      if (state.mode === "offline") throw new Error("Synthetic offline failure");
      if (state.mode === "hold") return new Promise(resolve => {
        state.release = () => resolve({ error: { message: "Synthetic authentication failure" } });
      });
      if (state.mode === "invalid") return { error: { message: "Invalid login credentials" } };
      listener?.("SIGNED_IN", session);
      return { data: { session }, error: null };
    },
    signUp: async ({ email, password, options }) => {
      state.signUps++;
      state.email = email;
      state.metadata = options.data;
      if (password.length < 8) throw new Error("Missing synthetic input");
      if (state.mode === "offline") throw new Error("Synthetic offline failure");
      if (state.mode === "signup-error") return { error: { message: "Signup disabled for synthetic check" } };
      if (state.mode === "hold") return new Promise(resolve => {
        state.release = () => resolve({ error: { message: "Synthetic registration failure" } });
      });
      const immediate = state.mode === "immediate";
      if (immediate) listener?.("SIGNED_IN", session);
      return { data: {
        user: { id: session.user.id, identities: state.mode === "existing" ? [] : [{ id: "synthetic-identity" }] },
        session: immediate ? session : null,
      }, error: null };
    },
    signOut: async () => { listener?.("SIGNED_OUT", null); return { error: null }; },
  },
  rpc: async (name, args) => {
    if (name === "my_profile" && ["pending", "restricted", "immediate"].includes(state.mode)) {
      return { data: { id: session.user.id, status: state.mode === "restricted" ? "Inactive" : "Pending" }, error: null };
    }
    return workflows.rpc(name, args);
  },
};
