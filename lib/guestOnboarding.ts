import type { StoredAnswerRow } from "@/types/question";
import type { Gender } from "@/types/user";

const DRAFT_KEY = "intersection-guest-onboarding-v1";
const PHOTO_DATABASE = "intersection-guest-onboarding";
const PHOTO_STORE = "draft-files";
const PHOTO_KEY = "profile-photo";

export type GuestBasicInfo = {
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
};

export type GuestOnboardingDraft = {
  version: 1;
  id: string;
  phase: "questions" | "profile";
  answers: StoredAnswerRow[];
  profile: GuestBasicInfo;
  updatedAt: string;
};

type StoredPhoto = {
  draftId: string;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export const emptyGuestBasicInfo: GuestBasicInfo = {
  name: "",
  phone: "",
  gender: "",
  birthYear: "",
  mbti: "",
};

export function emptyGuestOnboardingDraft(): GuestOnboardingDraft {
  return {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    phase: "questions",
    answers: [],
    profile: { ...emptyGuestBasicInfo },
    updatedAt: new Date().toISOString(),
  };
}

function isStoredAnswerRow(value: unknown): value is StoredAnswerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredAnswerRow>;
  return Number.isInteger(row.question_order);
}

function profileFromUnknown(value: unknown): GuestBasicInfo {
  if (!value || typeof value !== "object") return { ...emptyGuestBasicInfo };
  const profile = value as Partial<GuestBasicInfo>;
  return {
    name: typeof profile.name === "string" ? profile.name : "",
    phone: typeof profile.phone === "string" ? profile.phone : "",
    gender:
      profile.gender === "남성" || profile.gender === "여성"
        ? profile.gender
        : "",
    birthYear:
      typeof profile.birthYear === "string" ? profile.birthYear : "",
    mbti: typeof profile.mbti === "string" ? profile.mbti : "",
  };
}

export function loadGuestOnboardingDraft(): GuestOnboardingDraft {
  if (typeof window === "undefined") return emptyGuestOnboardingDraft();

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "null") as
      | Partial<GuestOnboardingDraft>
      | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.id !== "string") {
      return emptyGuestOnboardingDraft();
    }

    return {
      version: 1,
      id: parsed.id,
      phase: parsed.phase === "profile" ? "profile" : "questions",
      answers: Array.isArray(parsed.answers)
        ? parsed.answers.filter(isStoredAnswerRow)
        : [],
      profile: profileFromUnknown(parsed.profile),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return emptyGuestOnboardingDraft();
  }
}

export function saveGuestOnboardingDraft(draft: GuestOnboardingDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  );
}

function openPhotoDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(PHOTO_DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PHOTO_STORE)) {
        database.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withPhotoStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openPhotoDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, mode);
      const request = operation(transaction.objectStore(PHOTO_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveGuestProfilePhoto(file: File, draftId: string) {
  const storedPhoto: StoredPhoto = {
    draftId,
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };
  await withPhotoStore("readwrite", (store) =>
    store.put(storedPhoto, PHOTO_KEY),
  );
}

export async function loadGuestProfilePhoto(draftId: string) {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  try {
    const stored = await withPhotoStore<StoredPhoto | undefined>(
      "readonly",
      (store) => store.get(PHOTO_KEY),
    );
    if (!stored?.blob || stored.draftId !== draftId) return null;
    return new File([stored.blob], stored.name || "profile-photo", {
      type: stored.type || stored.blob.type,
      lastModified: stored.lastModified || Date.now(),
    });
  } catch {
    return null;
  }
}

export async function clearGuestOnboardingDraft() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(DRAFT_KEY);
  }
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    await withPhotoStore("readwrite", (store) => store.delete(PHOTO_KEY));
  } catch {
    // The text draft is already cleared; a missing IndexedDB is harmless.
  }
}
