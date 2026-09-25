tsx
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

type Role = "owner" | "staff" | "reader";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Novel = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_path: string | null;
  category_id: string | null;
  status: "ongoing" | "completed";
  language: string;
  direction: "rtl" | "ltr";
  published: boolean;
  created_by: string | null;
  created_at: string;
  categories?: Category | null;
};

type Chapter = {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string | null;
  published: boolean;
  access_type: "free" | "paid";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChapterBlockType =
  | "text"
  | "heading"
  | "image"
  | "gif"
  | "audio"
  | "quote"
  | "divider";

type ChapterBlock = {
  id: string;
  chapter_id: string;
  block_order: number;
  block_type: ChapterBlockType;
  content: string | null;
  media_path: string | null;
  media_label: string | null;
  align: "right" | "left" | "center" | "full";
  width: number | null;
  height: number | null;
};

type AccountSection =
  | "profile"
  | "favorites"
  | "history"
  | "notifications";

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeStorageId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNovels, setShowNovels] = useState(true);

  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);

  const [activeSection, setActiveSection] =
    useState<AccountSection>("profile");

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingAccountData, setLoadingAccountData] = useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showNovelForm, setShowNovelForm] = useState(false);
  const [savingNovel, setSavingNovel] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] = useState("");
  const [novelCategory, setNovelCategory] = useState("");
  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");
  const [novelLanguage, setNovelLanguage] = useState("العربية");
  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");
  const [novelCoverPath, setNovelCoverPath] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [novelMessage, setNovelMessage] = useState("");

  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [managingStaff, setManagingStaff] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [showChapterForm, setShowChapterForm] = useState(false);
  const [savingChapter, setSavingChapter] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterMessage, setChapterMessage] = useState("");

  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterBlocks, setChapterBlocks] = useState<ChapterBlock[]>([]);
  const [loadingChapterBlocks, setLoadingChapterBlocks] = useState(false);
  const [savingChapterBlocks, setSavingChapterBlocks] = useState(false);

  const [newBlockType, setNewBlockType] =
    useState<ChapterBlockType>("text");
  const [newBlockContent, setNewBlockContent] = useState("");
  const [newBlockMediaPath, setNewBlockMediaPath] = useState("");
  const [newBlockMediaLabel, setNewBlockMediaLabel] = useState("");
  const [new
