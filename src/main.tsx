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
  updated_at?: string;
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
  const [selectedNovelAdminView, setSelectedNovelAdminView] = useState(false);

  const [activeSection, setActiveSection] =
    useState<AccountSection>("profile");

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingAccountData, setLoadingAccountData] = useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [readerProgress, setReaderProgress] = useState(0);

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
  const [newBlockMediaPreviewUrl, setNewBlockMediaPreviewUrl] = useState("");
  const [newBlockLocalPreviewUrl, setNewBlockLocalPreviewUrl] = useState("");
  const [newBlockMediaFile, setNewBlockMediaFile] = useState<File | null>(null);
  const [newBlockAlign, setNewBlockAlign] =
    useState<"right" | "left" | "center" | "full">("center");
  const [newBlockWidth, setNewBlockWidth] = useState("");
  const [newBlockHeight, setNewBlockHeight] = useState("");
  const [uploadingBlockMedia, setUploadingBlockMedia] = useState(false);

  const [authMode, setAuthMode] =
    useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [siteMessage, setSiteMessage] = useState("");

  const isOwner = profile?.role === "owner";
  const isStaff = profile?.role === "staff";
  const canManage = isOwner || isStaff;

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const filteredNovels = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ar");
    return publishedNovels.filter((novel) => {
      const matchesQuery =
        !query ||
        novel.title.toLocaleLowerCase("ar").includes(query) ||
        (novel.description || "").toLocaleLowerCase("ar").includes(query);
      const matchesCategory =
        selectedCategoryFilter === "all" ||
        novel.category_id === selectedCategoryFilter;
      const matchesStatus =
        selectedStatusFilter === "all" ||
        novel.status === selectedStatusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [
    publishedNovels,
    searchQuery,
    selectedCategoryFilter,
    selectedStatusFilter,
  ]);

  const currentChapterIndex = useMemo(
    () =>
      selectedChapter
        ? chapters.findIndex((chapter) => chapter.id === selectedChapter.id)
        : -1,
    [chapters, selectedChapter]
  );

  const previousChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;

  const readerBlocks = useMemo(() => {
    const sorted = [...chapterBlocks].sort(
      (a, b) => a.block_order - b.block_order
    );

    const audioBlocks = sorted.filter(
      (block) => block.block_type === "audio"
    );

    const otherBlocks = sorted.filter(
      (block) => block.block_type !== "audio"
    );

    return [...audioBlocks, ...otherBlocks];
  }, [chapterBlocks]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setFavorites([]);
        setHistory([]);
        setNotifications([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadPublishedNovels();
    loadCategories();
  }, []);

  useEffect(() => {
    if (canManage) {
      loadAdminData();
      loadStaffMembers();
    }
  }, [canManage]);

  useEffect(() => {
    if (user) {
      loadAccountData();
    }
  }, [user]);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile error:", error);
      return;
    }

    setProfile(data as Profile | null);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Categories error:", error);
      return;
    }

    setCategories((data ?? []) as Category[]);
  }

  async function loadPublishedNovels() {
    const { data, error } = await supabase
      .from("novels")
      .select("*, categories(*)")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Published novels error:", error);
      return;
    }

    setPublishedNovels((data ?? []) as Novel[]);
  }

  async function loadAdminData() {
    const { data, error } = await supabase
      .from("novels")
      .select("*, categories(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin novels error:", error);
      return;
    }

    setNovels((data ?? []) as Novel[]);
  }

  async function loadStaffMembers() {
    if (!isOwner) return;

    setLoadingStaff(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "list",
          },
        }
      );

      if (error) {
        setStaffMessage(error.message || "تعذر تحميل المشرفين");
        return;
      }

      setStaffMembers(data?.staff ?? data?.users ?? []);
    } catch (error: any) {
      setStaffMessage(
        error?.message || "حدث خطأ أثناء تحميل المشرفين"
      );
    } finally {
      setLoadingStaff(false);
    }
  }

  async function loadAccountData() {
    if (!user) return;

    setLoadingAccountData(true);

    try {
      const [favoritesResult, historyResult, notificationsResult] =
        await Promise.all([
          supabase
            .from("favorites")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("reading_progress")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),

          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (!favoritesResult.error) {
        setFavorites(favoritesResult.data ?? []);
      }

      if (!historyResult.error) {
        setHistory(historyResult.data ?? []);
      }

      if (!notificationsResult.error) {
        setNotifications(notificationsResult.data ?? []);
      }
    } finally {
      setLoadingAccountData(false);
    }
  }

  async function markNotificationRead(id: string) {
    if (!user) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Notification error:", error);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              read_at: now,
            }
          : item
      )
    );
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(true);
  }

  async function signInWithGoogle() {
    setAuthLoading(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage(error.message);
    }

    setAuthLoading(false);
  }

  async function handleEmailAuth() {
    const email = authEmail.trim();

    if (!email || !authPassword) {
      setAuthMessage("اكتبي البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        });

        if (error) {
          setAuthMessage(error.message);
        } else {
          setAuthEmail("");
          setAuthPassword("");
          setShowAccount(false);
          setShowAdmin(false);
          setShowNovels(true);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: authPassword,
        });

        if (error) {
          setAuthMessage(error.message);
        } else {
          setAuthMessage(
            "تم إنشاء الحساب. إذا ظهر طلب تأكيد البريد، افتحي بريدك الإلكتروني."
          );
        }
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function toggleFavorite(novel: Novel) {
    if (!user) {
      setSiteMessage("سجلي الدخول أولًا لإضافة الرواية إلى المفضلة.");
      return;
    }

    const existing = favorites.find(
      (item) => item.novel_id === novel.id
    );

    if (existing) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) {
        setSiteMessage(error.message);
        return;
      }

      setFavorites((current) =>
        current.filter((item) => item.id !== existing.id)
      );
    } else {
      const { data, error } = await supabase
        .from("favorites")
        .insert({
          user_id: user.id,
          novel_id: novel.id,
        })
        .select()
        .single();

      if (error) {
        setSiteMessage(error.message);
        return;
      }

      if (data) {
        setFavorites((current) => [data, ...current]);
      }
    }
  }

  function isFavorite(novelId: string) {
    return favorites.some((item) => item.novel_id === novelId);
  }

  async function uploadNovelCover(file: File) {
    setUploadingCover(true);
    setNovelMessage("");

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const path = `covers/${makeStorageId()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        setNovelMessage(uploadError.message);
        return;
      }

      setNovelCoverPath(path);
      setNovelMessage("تم رفع الغلاف بنجاح.");
    } catch (error: any) {
      setNovelMessage(error?.message || "تعذر رفع الغلاف.");
    } finally {
      setUploadingCover(false);
    }
  }

  function resetNovelForm() {
    setEditingNovelId(null);
    setNovelTitle("");
    setNovelDescription("");
    setNovelCategory("");
    setNovelStatus("ongoing");
    setNovelLanguage("العربية");
    setNovelDirection("rtl");
    setNovelCoverPath("");
    setNovelMessage("");
  }

  function editNovel(novel: Novel) {
    setEditingNovelId(novel.id);
    setNovelTitle(novel.title);
    setNovelDescription(novel.description || "");
    setNovelCategory(novel.category_id || "");
    setNovelStatus(novel.status);
    setNovelLanguage(novel.language || "العربية");
    setNovelDirection(novel.direction || "rtl");
    setNovelCoverPath(novel.cover_path || "");
    setNovelMessage("");
    setShowNovelForm(true);
    setShowAdmin(true);
    setShowNovels(false);
    setShowAccount(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveNovel(publish: boolean) {
    if (!canManage) return;

    if (!novelTitle.trim()) {
      setNovelMessage("اكتبي اسم الرواية.");
      return;
    }

    setSavingNovel(true);
    setNovelMessage("");

    try {
      const slug = makeSlug(novelTitle);

      const payload = {
        title: novelTitle.trim(),
        slug,
        description: novelDescription.trim() || null,
        cover_path: novelCoverPath || null,
        category_id: novelCategory || null,
        status: novelStatus,
        language: novelLanguage.trim() || "العربية",
        direction: novelDirection,
        published: publish,
        created_by: user?.id ?? null,
      };

      if (editingNovelId) {
        const { data, error } = await supabase
          .from("novels")
          .update({
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            cover_path: payload.cover_path,
            category_id: payload.category_id,
            status: payload.status,
            language: payload.language,
            direction: payload.direction,
            published: payload.published,
          })
          .eq("id", editingNovelId)
          .select("*, categories(*)")
          .single();

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        setNovels((current) =>
          current.map((item) =>
            item.id === editingNovelId
              ? (data as Novel)
              : item
          )
        );

        setPublishedNovels((current) => {
          if (!data.published) {
            return current.filter(
              (item) => item.id !== editingNovelId
            );
          }

          const exists = current.some(
            (item) => item.id === editingNovelId
          );

          if (exists) {
            return current.map((item) =>
              item.id === editingNovelId
                ? (data as Novel)
                : item
            );
          }

          return [data as Novel, ...current];
        });

        setSelectedNovel((current) =>
          current?.id === editingNovelId
            ? (data as Novel)
            : current
        );

        setNovelMessage(
          publish
            ? "تم تحديث الرواية ونشرها."
            : "تم تحديث الرواية كمسودة."
        );
      } else {
        const { data, error } = await supabase
          .from("novels")
          .insert(payload)
          .select("*, categories(*)")
          .single();

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        setNovels((current) => [data as Novel, ...current]);

        if (data.published) {
          setPublishedNovels((current) => [
            data as Novel,
            ...current,
          ]);
        }

        setNovelMessage(
          publish
            ? "تم إنشاء الرواية ونشرها."
            : "تم حفظ الرواية كمسودة."
        );
      }

      resetNovelForm();
      setShowNovelForm(false);
    } catch (error: any) {
      setNovelMessage(error?.message || "حدث خطأ أثناء حفظ الرواية.");
    } finally {
      setSavingNovel(false);
    }
  }

  async function toggleNovelPublished(novel: Novel) {
    if (!canManage) return;

    const nextPublished = !novel.published;

    const { data, error } = await supabase
      .from("novels")
      .update({
        published: nextPublished,
      })
      .eq("id", novel.id)
      .select("*, categories(*)")
      .single();

    if (error) {
      setSiteMessage(error.message);
      return;
    }

    setNovels((current) =>
      current.map((item) =>
        item.id === novel.id ? (data as Novel) : item
      )
    );

    if (nextPublished) {
      setPublishedNovels((current) => {
        const exists = current.some(
          (item) => item.id === novel.id
        );

        if (exists) {
          return current.map((item) =>
            item.id === novel.id ? (data as Novel) : item
          );
        }

        return [data as Novel, ...current];
      });
    } else {
      setPublishedNovels((current) =>
        current.filter((item) => item.id !== novel.id)
      );
    }

    setSelectedNovel((current) =>
      current?.id === novel.id ? (data as Novel) : current
    );
  }

  async function deleteNovel(novel: Novel) {
    if (!isOwner) return;

    const confirmed = window.confirm(
      `هل أنت متأكدة من حذف رواية "${novel.title}"؟\n\nسيتم حذف الرواية من قاعدة البيانات.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("novels")
      .delete()
      .eq("id", novel.id);

    if (error) {
      setSiteMessage(error.message);
      return;
    }

    setNovels((current) =>
      current.filter((item) => item.id !== novel.id)
    );

    setPublishedNovels((current) =>
      current.filter((item) => item.id !== novel.id)
    );

    if (selectedNovel?.id === novel.id) {
      setSelectedNovel(null);
    }

    setSiteMessage("تم حذف الرواية.");
  }

  async function openNovel(
    novel: Novel,
    adminView: boolean = false
  ) {
    setSelectedNovel(novel);
    setSelectedNovelAdminView(adminView);
    setSelectedChapter(null);
    setChapterBlocks([]);
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(false);
    setSiteMessage("");

    await loadChapters(novel.id, adminView);
  }

  async function loadChapters(
    novelId: string,
    adminView: boolean
  ) {
    setLoadingChapters(true);

    try {
      let query = supabase
        .from("chapters")
        .select("*")
        .eq("novel_id", novelId)
        .order("chapter_number", { ascending: true });

      if (!adminView) {
        query = query.eq("published", true);
      }

      const { data, error } = await query;

      if (error) {
        setSiteMessage(error.message);
        return;
      }

      setChapters((data ?? []) as Chapter[]);
    } finally {
      setLoadingChapters(false);
    }
  }

  function resetChapterForm() {
    setEditingChapterId(null);
    setChapterNumber("");
    setChapterTitle("");
    setChapterMessage("");
  }

  function editChapter(chapter: Chapter) {
    setEditingChapterId(chapter.id);
    setChapterNumber(String(chapter.chapter_number));
    setChapterTitle(chapter.title || "");
    setChapterMessage("");
    setShowChapterForm(true);
  }

  async function saveChapter(publish: boolean) {
    if (!selectedNovel || !canManage) return;

    const number = Number(chapterNumber);

    if (!Number.isFinite(number)) {
      setChapterMessage("اكتبي رقم فصل صحيح.");
      return;
    }

    setSavingChapter(true);
    setChapterMessage("");

    try {
      if (editingChapterId) {
        const { data, error } = await supabase
          .from("chapters")
          .update({
            chapter_number: number,
            title: chapterTitle.trim() || null,
            published: publish,
            published_at: publish
              ? new Date().toISOString()
              : null,
          })
          .eq("id", editingChapterId)
          .select("*")
          .single();

        if (error) {
          setChapterMessage(error.message);
          return;
        }

        setChapters((current) =>
          current
            .map((item) =>
              item.id === editingChapterId
                ? (data as Chapter)
                : item
            )
            .sort(
              (a, b) => a.chapter_number - b.chapter_number
            )
        );
      } else {
        const { data, error } = await supabase
          .from("chapters")
          .insert({
            novel_id: selectedNovel.id,
            chapter_number: number,
            title: chapterTitle.trim() || null,
            published: publish,
            access_type: "free",
            published_at: publish
              ? new Date().toISOString()
              : null,
          })
          .select("*")
          .single();

        if (error) {
          setChapterMessage(error.message);
          return;
        }

        setChapters((current) =>
          [...current, data as Chapter].sort(
            (a, b) => a.chapter_number - b.chapter_number
          )
        );
      }

      resetChapterForm();
      setShowChapterForm(false);
      setSiteMessage(
        publish
          ? "تم حفظ الفصل ونشره."
          : "تم حفظ الفصل كمسودة."
      );
    } finally {
      setSavingChapter(false);
    }
  }

  async function toggleChapterPublished(chapter: Chapter) {
    if (!canManage) return;

    const nextPublished = !chapter.published;

    const { data, error } = await supabase
      .from("chapters")
      .update({
        published: nextPublished,
        published_at: nextPublished
          ? new Date().toISOString()
          : null,
      })
      .eq("id", chapter.id)
      .select("*")
      .single();

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapters((current) =>
      current
        .map((item) =>
          item.id === chapter.id ? (data as Chapter) : item
        )
        .sort((a, b) => a.chapter_number - b.chapter_number)
    );
  }
  async function deleteChapter(chapter: Chapter) {
    if (!canManage) return;

    const confirmed = window.confirm(
      `هل أنتِ متأكدة من حذف الفصل ${chapter.chapter_number}؟`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("chapters")
      .delete()
      .eq("id", chapter.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapters((current) =>
      current.filter((item) => item.id !== chapter.id)
    );

    if (selectedChapter?.id === chapter.id) {
      setSelectedChapter(null);
      setChapterBlocks([]);
    }
  }

  async function openChapter(chapter: Chapter) {
    if (!selectedNovel) return;

    setSelectedChapter(chapter);
    setReaderProgress(0);
    setLoadingChapterBlocks(true);
    setChapterMessage("");
    setShowChapterForm(false);

    try {
      const { data, error } = await supabase
        .from("chapter_blocks")
        .select("*")
        .eq("chapter_id", chapter.id)
        .order("block_order", { ascending: true });

      if (error) {
        setChapterMessage(error.message);
        return;
      }

      setChapterBlocks((data ?? []) as ChapterBlock[]);

      let savedProgress = 0;
      if (!selectedNovelAdminView && user) {
        const { data: progress } = await supabase
          .from("reading_progress")
          .select("chapter_id, progress_percent")
          .eq("user_id", user.id)
          .eq("novel_id", selectedNovel.id)
          .maybeSingle();

        savedProgress =
          progress?.chapter_id === chapter.id
            ? Number(progress?.progress_percent || 0)
            : 0;
        setReaderProgress(savedProgress);
        await saveReadingProgress(selectedNovel.id, chapter.id, savedProgress);
      }

      if (!selectedNovelAdminView) {
        window.setTimeout(() => {
          if (savedProgress > 2) {
            window.scrollTo({
              top:
                (document.documentElement.scrollHeight - window.innerHeight) *
                (savedProgress / 100),
              behavior: "smooth",
            });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 80);
      }
    } finally {
      setLoadingChapterBlocks(false);
    }
  }

  async function saveReadingProgress(
    novelId: string,
    chapterId: string,
    progressPercent = 0
  ) {
    if (!user) return;

    const { data: existing, error: findError } = await supabase
      .from("reading_progress")
      .select("id")
      .eq("user_id", user.id)
      .eq("novel_id", novelId)
      .maybeSingle();

    if (findError) {
      return;
    }

    if (existing?.id) {
      await supabase
        .from("reading_progress")
        .update({
          chapter_id: chapterId,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("reading_progress").insert({
        user_id: user.id,
        novel_id: novelId,
        chapter_id: chapterId,
        progress_percent: progressPercent,
        updated_at: new Date().toISOString(),
      });
    }

    loadAccountData();
  }

  async function saveReaderScrollProgress() {
    if (!user || !selectedNovel || !selectedChapter || selectedNovelAdminView) return;
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const percent = Math.min(
      100,
      Math.max(0, Math.round((window.scrollY / maxScroll) * 100))
    );
    setReaderProgress(percent);

    await supabase
      .from("reading_progress")
      .update({
        chapter_id: selectedChapter.id,
        progress_percent: percent,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("novel_id", selectedNovel.id);
  }

  useEffect(() => {
    if (!selectedChapter || selectedNovelAdminView || !user) return;

    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveReaderScrollProgress();
      }, 500);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [selectedChapter?.id, selectedNovel?.id, selectedNovelAdminView, user?.id]);

  function continueReading(novel: Novel) {
    const progress = history.find((item) => item.novel_id === novel.id);
    openNovel(novel, false);
    if (progress?.chapter_id) {
      window.setTimeout(async () => {
        const { data } = await supabase
          .from("chapters")
          .select("*")
          .eq("id", progress.chapter_id)
          .eq("novel_id", novel.id)
          .maybeSingle();
        if (data) {
          await openChapter(data as Chapter);
        }
      }, 120);
    }
  }


  function resetBlockForm() {
    setNewBlockType("text");
    setNewBlockContent("");
    setNewBlockMediaPath("");
    setNewBlockMediaLabel("");
    setNewBlockMediaPreviewUrl("");
    setNewBlockLocalPreviewUrl("");
    setNewBlockMediaFile(null);
    setNewBlockAlign("center");
    setNewBlockWidth("");
    setNewBlockHeight("");
  }

  async function uploadChapterMedia(file: File) {
    if (!selectedChapter) return "";

    setUploadingBlockMedia(true);
    setChapterMessage("");

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "bin";

      const bucket =
        newBlockType === "audio" ? "audio" : "chapter-media";
      const path = `${newBlockType}/${makeStorageId()}.${extension}`;
      const contentType =
        newBlockType === "gif"
          ? "image/gif"
          : file.type || undefined;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });

      if (error) {
        setChapterMessage(`تعذر رفع الملف: ${error.message}`);
        return "";
      }

      setNewBlockMediaPath(path);

      if (newBlockType === "audio") {
        const publicUrl = getPublicMediaUrl(bucket, path);
        if (publicUrl) {
          setNewBlockMediaPreviewUrl(publicUrl);
        }
      }

      return path;
    } catch (error: any) {
      setChapterMessage(
        error?.message || "تعذر رفع الملف."
      );
      return "";
    } finally {
      setUploadingBlockMedia(false);
    }
  }

  function getPublicMediaUrl(
    bucket: string,
    path: string | null
  ) {
    if (!path) return "";

    if (
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      return path;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function addChapterBlock() {
    if (!selectedChapter || !canManage) return;

    if (
      ["text", "heading", "quote"].includes(newBlockType) &&
      !newBlockContent.trim()
    ) {
      setChapterMessage("اكتبي محتوى العنصر أولًا.");
      return;
    }

    if (
      ["image", "gif", "audio"].includes(newBlockType) &&
      !newBlockMediaPath &&
      !newBlockMediaFile
    ) {
      setChapterMessage("اختاري الملف أولًا.");
      return;
    }

    setSavingChapterBlocks(true);
    setChapterMessage("");

    try {
      let mediaPath = newBlockMediaPath;

      if (
        ["image", "gif", "audio"].includes(newBlockType) &&
        !mediaPath &&
        newBlockMediaFile
      ) {
        setChapterMessage("جارٍ رفع الملف وحفظه...");
        mediaPath = await uploadChapterMedia(newBlockMediaFile);

        if (!mediaPath) {
          return;
        }
      }

      const nextOrder =
        chapterBlocks.length > 0
          ? Math.max(
              ...chapterBlocks.map(
                (block) => block.block_order
              )
            ) + 1
          : 1;

      const { data, error } = await supabase
        .from("chapter_blocks")
        .insert({
          chapter_id: selectedChapter.id,
          block_order: nextOrder,
          block_type: newBlockType,
          content:
            newBlockType === "divider"
              ? null
              : newBlockContent.trim() || null,
          media_path: mediaPath || null,
          media_label:
            newBlockMediaLabel.trim() || null,
          align: newBlockAlign,
          width: newBlockWidth
            ? Number(newBlockWidth)
            : null,
          height: newBlockHeight
            ? Number(newBlockHeight)
            : null,
        })
        .select("*")
        .single();

      if (error) {
        setChapterMessage(error.message);
        return;
      }

      setChapterBlocks((current) =>
        [...current, data as ChapterBlock].sort(
          (a, b) => a.block_order - b.block_order
        )
      );

      resetBlockForm();
      setChapterMessage("تمت إضافة العنصر.");
    } finally {
      setSavingChapterBlocks(false);
    }
  }

  async function deleteChapterBlock(block: ChapterBlock) {
    if (!canManage) return;

    const confirmed = window.confirm(
      "هل أنت متأكدة من حذف هذا العنصر؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("chapter_blocks")
      .delete()
      .eq("id", block.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.filter((item) => item.id !== block.id)
    );
  }

  async function moveChapterBlock(
    block: ChapterBlock,
    direction: "up" | "down"
  ) {
    if (!canManage) return;

    const sorted = [...chapterBlocks].sort(
      (a, b) => a.block_order - b.block_order
    );

    const index = sorted.findIndex(
      (item) => item.id === block.id
    );

    if (index === -1) return;

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= sorted.length
    ) {
      return;
    }

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = current.block_order;
    const targetOrder = target.block_order;

    const first = await supabase
      .from("chapter_blocks")
      .update({
        block_order: -1,
      })
      .eq("id", current.id);

    if (first.error) {
      setChapterMessage(first.error.message);
      return;
    }

    const second = await supabase
      .from("chapter_blocks")
      .update({
        block_order: currentOrder,
      })
      .eq("id", target.id);

    if (second.error) {
      setChapterMessage(second.error.message);
      return;
    }

    const third = await supabase
      .from("chapter_blocks")
      .update({
        block_order: targetOrder,
      })
      .eq("id", current.id);

    if (third.error) {
      setChapterMessage(third.error.message);
      return;
    }

    setChapterBlocks((currentBlocks) =>
      currentBlocks
        .map((item) => {
          if (item.id === current.id) {
            return {
              ...item,
              block_order: targetOrder,
            };
          }

          if (item.id === target.id) {
            return {
              ...item,
              block_order: currentOrder,
            };
          }

          return item;
        })
        .sort((a, b) => a.block_order - b.block_order)
    );
  }

  function closeChapter() {
    setSelectedChapter(null);
    setChapterBlocks([]);
    setChapterMessage("");
  }

  function goHome() {
    setSelectedChapter(null);
    setSelectedNovel(null);
    setSelectedNovelAdminView(false);
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(true);
    setSiteMessage("");
  }

  function openAccount(section: AccountSection = "profile") {
    setActiveSection(section);
    setShowAccount(true);
    setShowAdmin(false);
    setShowNovels(false);
    setSelectedNovel(null);
    setSelectedChapter(null);
  }

  function openAdmin() {
    if (!canManage) return;

    setShowAdmin(true);
    setShowAccount(false);
    setShowNovels(false);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setSelectedNovelAdminView(false);
  }

  async function addStaff() {
    if (!isOwner) return;

    const email = staffEmail.trim().toLowerCase();

    if (!email) {
      setStaffMessage("اكتبي البريد الإلكتروني للمشرف.");
      return;
    }

    setManagingStaff(true);
    setStaffMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "set_role",
            email,
            role: "staff",
          },
        }
      );

      if (error) {
        setStaffMessage(
          error.message || "تعذر إضافة المشرف."
        );
        return;
      }

      setStaffEmail("");
      setStaffMessage(
        data?.message || "تمت إضافة المشرف بنجاح."
      );

      await loadStaffMembers();
    } catch (error: any) {
      setStaffMessage(
        error?.message || "حدث خطأ أثناء إضافة المشرف."
      );
    } finally {
      setManagingStaff(false);
    }
  }

  async function removeStaff(staff: any) {
    if (!isOwner) return;

    const email =
      staff.email ||
      staff.user_email ||
      staff.user?.email;

    if (!email) {
      setStaffMessage("تعذر معرفة بريد المشرف.");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكدة من إزالة صلاحية المشرف من ${email}؟`
    );

    if (!confirmed) return;

    setManagingStaff(true);
    setStaffMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "set_role",
            email,
            role: "reader",
          },
        }
      );

      if (error) {
        setStaffMessage(
          error.message || "تعذر إزالة صلاحية المشرف."
        );
        return;
      }

      setStaffMessage(
        data?.message || "تمت إزالة صلاحية المشرف."
      );

      await loadStaffMembers();
    } catch (error: any) {
      setStaffMessage(
        error?.message ||
          "حدث خطأ أثناء إزالة صلاحية المشرف."
      );
    } finally {
      setManagingStaff(false);
    }
  }

  function coverUrl(novel: Novel) {
    if (!novel.cover_path) return "";
    if (
      novel.cover_path.startsWith("http://") ||
      novel.cover_path.startsWith("https://")
    ) {
      return novel.cover_path;
    }

    return supabase.storage
      .from("covers")
      .getPublicUrl(novel.cover_path).data.publicUrl;
  }

  function renderChapterBlock(
    block: ChapterBlock,
    reader = true
  ) {
    const mediaBucket =
      block.block_type === "audio"
        ? "audio"
        : "chapter-media";

    const mediaUrl = getPublicMediaUrl(
      mediaBucket,
      block.media_path
    );

    const sizeStyle: React.CSSProperties = {
      width:
        block.width && block.width > 0
          ? `${block.width}px`
          : undefined,
      height:
        block.height && block.height > 0
          ? `${block.height}px`
          : undefined,
      maxWidth: "100%",
    };

    const alignClass =
      block.align === "right"
        ? "block-align-right"
        : block.align === "left"
          ? "block-align-left"
          : block.align === "full"
            ? "block-align-full"
            : "block-align-center";

    if (block.block_type === "heading") {
      return (
        <h2
          key={block.id}
          className={`chapter-heading ${alignClass}`}
        >
          {block.content}
        </h2>
      );
    }

    if (block.block_type === "quote") {
      return (
        <blockquote
          key={block.id}
          className={`chapter-quote ${alignClass}`}
        >
          {block.content}
        </blockquote>
      );
    }

    if (block.block_type === "divider") {
      return (
        <hr
          key={block.id}
          className="chapter-divider"
        />
      );
    }

    if (
      block.block_type === "image" ||
      block.block_type === "gif"
    ) {
      return (
        <figure
          key={block.id}
          className={`chapter-media-block ${alignClass}`}
        >
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt={block.media_label || ""}
              style={sizeStyle}
              className="chapter-image"
            />
          ) : (
            <div className="empty-media">
              لم يتم العثور على الصورة.
            </div>
          )}
        </figure>
      );
    }

    if (block.block_type === "audio") {
      return (
        <div
          key={block.id}
          className={`chapter-audio-block ${alignClass}`}
        >
          {block.media_label && (
            <div className="audio-label">
              {block.media_label}
            </div>
          )}

          {mediaUrl ? (
            <audio
              controls
              preload="metadata"
              src={mediaUrl}
              style={sizeStyle}
            />
          ) : (
            <div className="empty-media">
              لم يتم العثور على الملف الصوتي.
            </div>
          )}
        </div>
      );
    }

    return (
      <p
        key={block.id}
        className={`chapter-text ${alignClass}`}
        dir={selectedNovel?.direction || "rtl"}
      >
        {block.content}
      </p>
    );
  }

  function renderAuthPanel() {
    return (
      <section className="auth-page">
        <div className="auth-card card">
          <div className="auth-header">
            <span className="brand-mark">✦</span>
            <h1>روايات خيالية</h1>
            <p>
              مساحة هادئة لقراءة الروايات والقصص.
            </p>
          </div>

          <div className="auth-tabs">
            <button
              className={
                authMode === "login"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
            >
              تسجيل الدخول
            </button>

            <button
              className={
                authMode === "register"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setAuthMode("register");
                setAuthMessage("");
              }}
            >
              إنشاء حساب
            </button>
          </div>

          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input
              type="email"
              value={authEmail}
              onChange={(event) =>
                setAuthEmail(event.target.value)
              }
              placeholder="example@email.com"
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={authPassword}
              onChange={(event) =>
                setAuthPassword(event.target.value)
              }
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          {authMessage && (
            <div className="message-box">
              {authMessage}
            </div>
          )}

          <button
            className="primary-button full-width"
            onClick={handleEmailAuth}
            disabled={authLoading}
          >
            {authLoading
              ? "جارٍ التنفيذ..."
              : authMode === "login"
                ? "دخول"
                : "إنشاء الحساب"}
          </button>

          <div className="auth-divider">
            <span>أو</span>
          </div>

          <button
            className="secondary-button full-width"
            onClick={signInWithGoogle}
            disabled={authLoading}
          >
            الدخول باستخدام Google
          </button>
        </div>
      </section>
    );
  }

  function renderHeader() {
    return (
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            onClick={goHome}
          >
            <span className="brand-mark">✦</span>
            <span>روايات خيالية</span>
          </button>

          <nav className="header-nav">
            <button onClick={goHome}>
              الروايات
            </button>

            {user && (
              <button
                onClick={() => openAccount("profile")}
              >
                حسابي
              </button>
            )}

            {canManage && (
              <button onClick={openAdmin}>
                لوحة الإدارة
              </button>
            )}

            {user ? (
              <button
                className="logout-button"
                onClick={logout}
              >
                تسجيل الخروج
              </button>
            ) : (
              <button
                className="primary-button small-button"
                onClick={() => {
                  setShowAccount(true);
                  setShowNovels(false);
                  setShowAdmin(false);
                  setSelectedNovel(null);
                  setSelectedChapter(null);
                }}
              >
                تسجيل الدخول
              </button>
            )}
          </nav>
        </div>
      </header>
    );
  }

  function renderNovelCard(novel: Novel) {
    const favorite = isFavorite(novel.id);
    const image = coverUrl(novel);

    return (
      <article
        key={novel.id}
        className="novel-card"
        onClick={() => openNovel(novel, false)}
      >
        <div className="novel-cover">
          {image ? (
            <img
              src={image}
              alt={novel.title}
            />
          ) : (
            <div className="cover-placeholder">
              <span>✦</span>
              <small>رواية</small>
            </div>
          )}
        </div>

        <div className="novel-card-body">
          <div className="novel-card-top">
            <h2>{novel.title}</h2>

            {user && (
              <button
                className={`favorite-button ${
                  favorite ? "is-favorite" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(novel);
                }}
                title={
                  favorite
                    ? "إزالة من المفضلة"
                    : "إضافة للمفضلة"
                }
              >
                {favorite ? "♥" : "♡"}
              </button>
            )}
          </div>

          {novel.categories?.name && (
            <div className="novel-category">
              {novel.categories.name}
            </div>
          )}

          {novel.description && (
            <p>{novel.description}</p>
          )}

          <div className="novel-meta">
            <span>
              {novel.status === "ongoing"
                ? "مستمرة"
                : "مكتملة"}
            </span>

            <span>{novel.language}</span>
          </div>
        </div>
      </article>
    );
  }

  function renderHome() {
    return (
      <section className="novels-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              مكتبة الروايات
            </span>

            <h1>روايات خيالية</h1>

            <p>
              اقرأ بهدوء، واترك القصة تأخذك إلى عالمها.
            </p>
          </div>
        </div>

        <div className="library-tools card">
          <div className="library-search">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحثي عن رواية أو وصف..."
              aria-label="بحث في الروايات"
            />
            <span>⌕</span>
          </div>

          <div className="library-filters">
            <button
              className={selectedCategoryFilter === "all" ? "category-filter-button active" : "category-filter-button"}
              onClick={() => setSelectedCategoryFilter("all")}
            >
              الكل
            </button>
            <select
              value={selectedCategoryFilter}
              onChange={(event) => setSelectedCategoryFilter(event.target.value)}
              aria-label="التصنيف"
            >
              <option value="all">التصنيفات</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select
              value={selectedCategoryFilter}
              onChange={(event) => setSelectedCategoryFilter(event.target.value)}
              aria-label="التصنيف"
            >
              <option value="all">كل التصنيفات</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(event) => setSelectedStatusFilter(event.target.value)}
              aria-label="حالة الرواية"
            >
              <option value="all">كل الحالات</option>
              <option value="ongoing">مستمرة</option>
              <option value="completed">مكتملة</option>
            </select>
          </div>
        </div>

        {siteMessage && (
          <div className="message-box">
            {siteMessage}
          </div>
        )}

        {filteredNovels.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">✦</div>
            <h2>لا توجد روايات منشورة بعد</h2>
            <p>
              ستظهر الروايات هنا عندما يتم نشرها.
            </p>
          </div>
        ) : (
          <div className="novels-grid">
            {filteredNovels.map(renderNovelCard)}
          </div>
        )}
      </section>
    );
  }

  function renderNovelForm() {
    if (!showNovelForm || !canManage) return null;

    return (
      <div className="admin-card novel-form-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {editingNovelId
                ? "تعديل الرواية"
                : "رواية جديدة"}
            </span>

            <h2>
              {editingNovelId
                ? "تعديل بيانات الرواية"
                : "إضافة رواية"}
            </h2>
          </div>

          <button
            className="secondary-button"
            onClick={() => {
              resetNovelForm();
              setShowNovelForm(false);
            }}
          >
            إغلاق
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>اسم الرواية</label>
            <input
              value={novelTitle}
              onChange={(event) =>
                setNovelTitle(event.target.value)
              }
              placeholder="مثال: لعنة القلعة"
            />
          </div>

          <div className="form-group">
            <label>التصنيف</label>
            <select
              value={novelCategory}
              onChange={(event) =>
                setNovelCategory(event.target.value)
              }
            >
              <option value="">
                بدون تصنيف
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>الحالة</label>
            <select
              value={novelStatus}
              onChange={(event) =>
                setNovelStatus(
                  event.target.value as
                    | "ongoing"
                    | "completed"
                )
              }
            >
              <option value="ongoing">
                مستمرة
              </option>

              <option value="completed">
                مكتملة
              </option>
            </select>
          </div>
            <div className="form-group">
            <label>لغة الرواية</label>
            <input
              value={novelLanguage}
              onChange={(event) =>
                setNovelLanguage(event.target.value)
              }
              placeholder="العربية"
            />
          </div>

          <div className="form-group">
            <label>اتجاه النص</label>
            <select
              value={novelDirection}
              onChange={(event) =>
                setNovelDirection(
                  event.target.value as "rtl" | "ltr"
                )
              }
            >
              <option value="rtl">
                من اليمين إلى اليسار
              </option>
              <option value="ltr">
                من اليسار إلى اليمين
              </option>
            </select>
          </div>

          <div className="form-group form-group-full">
            <label>الوصف</label>
            <textarea
              value={novelDescription}
              onChange={(event) =>
                setNovelDescription(
                  event.target.value
                )
              }
              rows={5}
              placeholder="نبذة قصيرة عن الرواية..."
            />
          </div>

          <div className="form-group form-group-full">
            <label>غلاف الرواية</label>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  uploadNovelCover(file);
                }
              }}
            />

            {uploadingCover && (
              <small className="form-hint">
                جارٍ رفع الغلاف...
              </small>
            )}

            {novelCoverPath && (
              <div className="uploaded-file">
                تم اختيار الغلاف.
              </div>
            )}
          </div>
        </div>

        {novelMessage && (
          <div className="message-box">
            {novelMessage}
          </div>
        )}

        <div className="button-row">
          <button
            className="secondary-button"
            disabled={savingNovel}
            onClick={() => saveNovel(false)}
          >
            حفظ كمسودة
          </button>

          <button
            className="primary-button"
            disabled={savingNovel}
            onClick={() => saveNovel(true)}
          >
            {savingNovel
              ? "جارٍ الحفظ..."
              : editingNovelId
                ? "حفظ ونشر"
                : "حفظ ونشر الرواية"}
          </button>
        </div>
      </div>
    );
  }

  function renderChapterForm() {
    if (!showChapterForm || !canManage) return null;

    return (
      <div className="admin-card chapter-form-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {editingChapterId
                ? "تعديل الفصل"
                : "فصل جديد"}
            </span>

            <h2>
              {editingChapterId
                ? "تعديل بيانات الفصل"
                : "إضافة فصل"}
            </h2>
          </div>

          <button
            className="secondary-button"
            onClick={() => {
              resetChapterForm();
              setShowChapterForm(false);
            }}
          >
            إغلاق
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>رقم الفصل</label>
            <input
              type="number"
              min="1"
              value={chapterNumber}
              onChange={(event) =>
                setChapterNumber(event.target.value)
              }
              placeholder="1"
            />
          </div>

          <div className="form-group">
            <label>عنوان الفصل</label>
            <input
              value={chapterTitle}
              onChange={(event) =>
                setChapterTitle(event.target.value)
              }
              placeholder="مثال: سر القلعة"
            />
          </div>
        </div>

        <p className="form-hint">
          نوع الوصول محفوظ حاليًا كـ Free، ويمكن استخدام
          نظام المدفوع مستقبلًا دون تفعيله الآن.
        </p>

        {chapterMessage && (
          <div className="message-box">
            {chapterMessage}
          </div>
        )}

        <div className="button-row">
          <button
            className="secondary-button"
            disabled={savingChapter}
            onClick={() => saveChapter(false)}
          >
            حفظ كمسودة
          </button>

          <button
            className="primary-button"
            disabled={savingChapter}
            onClick={() => saveChapter(true)}
          >
            {savingChapter
              ? "جارٍ الحفظ..."
              : editingChapterId
                ? "حفظ ونشر"
                : "حفظ ونشر الفصل"}
          </button>
        </div>
      </div>
    );
  }

  function renderBlockEditor() {
    if (!selectedChapter || !selectedNovelAdminView || !canManage) {
      return null;
    }

    return (
      <div className="chapter-editor">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              محرر الفصل
            </span>

            <h2>
              إضافة محتوى إلى الفصل{" "}
              {selectedChapter.chapter_number}
            </h2>
          </div>
        </div>

        <div className="editor-add-block">
          <div className="form-grid">
            <div className="form-group">
              <label>نوع العنصر</label>

              <select
                value={newBlockType}
                onChange={(event) => {
                  setNewBlockType(
                    event.target.value as ChapterBlockType
                  );
                  setNewBlockContent("");
                  setNewBlockMediaPath("");
                  setNewBlockMediaLabel("");
                  setNewBlockMediaPreviewUrl("");
                  setNewBlockLocalPreviewUrl("");
                  setNewBlockMediaFile(null);
                }}
              >
                <option value="text">نص</option>
                <option value="heading">عنوان</option>
                <option value="image">صورة</option>
                <option value="gif">GIF متحرك</option>
                <option value="audio">ملف صوتي</option>
                <option value="quote">اقتباس</option>
                <option value="divider">فاصل</option>
              </select>
            </div>

            {newBlockType !== "divider" &&
              !["image", "gif", "audio"].includes(
                newBlockType
              ) && (
                <div className="form-group form-group-full">
                  <label>المحتوى</label>

                  <textarea
                    value={newBlockContent}
                    onChange={(event) =>
                      setNewBlockContent(
                        event.target.value
                      )
                    }
                    rows={
                      newBlockType === "text"
                        ? 8
                        : 4
                    }
                    placeholder={
                      newBlockType === "heading"
                        ? "عنوان الفقرة"
                        : "اكتبي النص هنا..."
                    }
                  />
                </div>
              )}

            {["image", "gif", "audio"].includes(
              newBlockType
            ) && (
              <>
                <div className="form-group form-group-full">
                  <label>
                    {newBlockType === "audio"
                      ? "الملف الصوتي"
                      : newBlockType === "gif"
                        ? "صورة GIF"
                        : "الصورة"}
                  </label>

                  <input
                    type="file"
                    accept={
                      newBlockType === "audio"
                        ? "audio/*"
                        : newBlockType === "gif"
                          ? "image/gif,.gif"
                          : "image/*"
                    }
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0];

                      if (file) {
                        setNewBlockMediaFile(file);
                        setNewBlockMediaPath("");
                        setChapterMessage(
                          "تم اختيار الملف — اضغطي زر الحفظ لإضافته إلى الفصل."
                        );

                        const reader = new FileReader();
                        reader.onload = () => {
                          const previewUrl =
                            typeof reader.result === "string"
                              ? reader.result
                              : "";
                          setNewBlockLocalPreviewUrl(previewUrl);
                          setNewBlockMediaPreviewUrl(previewUrl);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {uploadingBlockMedia && (
                    <small className="form-hint">
                      جارٍ رفع الملف...
                    </small>
                  )}

                  {newBlockMediaFile && !uploadingBlockMedia && (
                    <small className="form-hint">
                      الملف جاهز — اضغطي زر الحفظ.
                    </small>
                  )}

                  {newBlockMediaPreviewUrl && (
                    <div className="media-upload-preview">
                      {newBlockType === "audio" ? (
                        <audio
                          controls
                          preload="metadata"
                          src={newBlockMediaPreviewUrl}
                          onError={() => {
                            if (
                              newBlockLocalPreviewUrl &&
                              newBlockMediaPreviewUrl !==
                                newBlockLocalPreviewUrl
                            ) {
                              setNewBlockMediaPreviewUrl(
                                newBlockLocalPreviewUrl
                              );
                              setChapterMessage(
                                "تم رفع الملف، والمعاينة المحلية تعمل. يمكنك حفظه الآن."
                              );
                            }
                          }}
                        />
                      ) : (
                        <img
                          src={newBlockMediaPreviewUrl}
                          alt={
                            newBlockType === "gif"
                              ? "معاينة GIF"
                              : "معاينة الصورة"
                          }
                          className="chapter-image"
                          onError={() => {
                            if (
                              newBlockLocalPreviewUrl &&
                              newBlockMediaPreviewUrl !==
                                newBlockLocalPreviewUrl
                            ) {
                              setNewBlockMediaPreviewUrl(
                                newBlockLocalPreviewUrl
                              );
                              setChapterMessage(
                                "المعاينة المحلية تعمل. الملف جاهز للحفظ."
                              );
                            }
                          }}
                        />
                      )}
                      <div className="uploaded-file">
                        {uploadingBlockMedia
                          ? "جارٍ رفع الملف..."
                          : newBlockMediaPath
                            ? "تم رفع الملف — جاهز للحفظ"
                            : newBlockMediaFile
                              ? "الملف جاهز للحفظ"
                              : "لم يتم اختيار ملف"}
                      </div>
                    </div>
                  )}
                </div>

                {newBlockType === "audio" && (
                  <div className="form-group form-group-full">
                    <label>اسم الصوت</label>

                    <input
                      value={newBlockMediaLabel}
                      onChange={(event) =>
                        setNewBlockMediaLabel(
                          event.target.value
                        )
                      }
                      placeholder="مثال: صوت المطر"
                    />

                    <small className="form-hint">
                      الصوت سيظهر دائمًا فوق النص
                      عند القراءة، ولن يعمل تلقائيًا.
                    </small>
                  </div>
                )}

                {newBlockType !== "audio" && (
                  <div className="form-group">
                    <label>مكان الصورة</label>

                    <select
                      value={newBlockAlign}
                      onChange={(event) =>
                        setNewBlockAlign(
                          event.target.value as
                            | "right"
                            | "left"
                            | "center"
                            | "full"
                        )
                      }
                    >
                      <option value="right">
                        يمين
                      </option>
                      <option value="center">
                        وسط
                      </option>
                      <option value="left">
                        يسار
                      </option>
                      <option value="full">
                        عرض كامل
                      </option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>العرض بالبكسل</label>

                  <input
                    type="number"
                    min="0"
                    value={newBlockWidth}
                    onChange={(event) =>
                      setNewBlockWidth(
                        event.target.value
                      )
                    }
                    placeholder="اختياري"
                  />
                </div>

                <div className="form-group">
                  <label>الارتفاع بالبكسل</label>

                  <input
                    type="number"
                    min="0"
                    value={newBlockHeight}
                    onChange={(event) =>
                      setNewBlockHeight(
                        event.target.value
                      )
                    }
                    placeholder="اختياري"
                  />
                </div>
              </>
            )}
          </div>

          {chapterMessage && (
            <div className="message-box">
              {chapterMessage}
            </div>
          )}

          <button
            className="primary-button"
            onClick={addChapterBlock}
            disabled={
              savingChapterBlocks ||
              uploadingBlockMedia
            }
          >
            {savingChapterBlocks
              ? "جارٍ الحفظ..."
              : newBlockType === "gif"
                ? "حفظ الـGIF في الفصل"
                : newBlockType === "image"
                  ? "حفظ الصورة في الفصل"
                  : newBlockType === "audio"
                    ? "حفظ الملف الصوتي في الفصل"
                    : "إضافة العنصر"}
          </button>
        </div>

        <div className="editor-block-list">
          {chapterBlocks.length === 0 ? (
            <div className="empty-state">
              لا توجد عناصر في الفصل بعد.
            </div>
          ) : (
            [...chapterBlocks]
              .sort(
                (a, b) =>
                  a.block_order - b.block_order
              )
              .map((block, index, array) => (
                <div
                  className="editor-block"
                  key={block.id}
                >
                  <div className="editor-block-header">
                    <strong>
                      {index + 1}.{" "}
                      {block.block_type === "text"
                        ? "نص"
                        : block.block_type ===
                            "heading"
                          ? "عنوان"
                          : block.block_type ===
                              "image"
                            ? "صورة"
                            : block.block_type ===
                                "gif"
                              ? "GIF"
                              : block.block_type ===
                                  "audio"
                                ? "صوت"
                                : block.block_type ===
                                    "quote"
                                  ? "اقتباس"
                                  : "فاصل"}
                    </strong>

                    <div className="editor-actions">
                      <button
                        className="icon-button"
                        disabled={index === 0}
                        onClick={() =>
                          moveChapterBlock(
                            block,
                            "up"
                          )
                        }
                        title="تحريك لأعلى"
                      >
                        ↑
                      </button>

                      <button
                        className="icon-button"
                        disabled={
                          index ===
                          array.length - 1
                        }
                        onClick={() =>
                          moveChapterBlock(
                            block,
                            "down"
                          )
                        }
                        title="تحريك لأسفل"
                      >
                        ↓
                      </button>

                      {canManage && (
                        <button
                          className="danger-button"
                          onClick={() =>
                            deleteChapterBlock(block)
                          }
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="editor-block-preview">
                    {renderChapterBlock(
                      block,
                      false
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    );
  }

  function renderChapterReader() {
    if (!selectedChapter || !selectedNovel) {
      return null;
    }

    return (
      <section
        className="chapter-reader-page"
        dir={selectedNovel.direction}
      >
        <div className="chapter-reader-top">
          <button
            className="secondary-button"
            onClick={closeChapter}
          >
            ← العودة للفصول
          </button>

          {selectedNovelAdminView &&
            canManage && (
              <button
                className="secondary-button"
                onClick={() => {
                  setSelectedChapter(null);
                  setChapterBlocks([]);
                }}
              >
                إغلاق المحرر
              </button>
            )}
        </div>

        {!selectedNovelAdminView && (
          <div className="reader-progress-shell">
            <div className="reader-progress-label">
              <span>تقدم القراءة</span>
              <span>{readerProgress}%</span>
            </div>
            <div className="reader-progress-track">
              <div className="reader-progress-bar" style={{ width: `${readerProgress}%` }} />
            </div>
          </div>
        )}

        <article className="chapter-reader">
          <div className="chapter-reader-header">
            <span className="eyebrow">
              {selectedNovel.title}
            </span>

            <h1>
              الفصل {selectedChapter.chapter_number}
            </h1>

            {selectedChapter.title && (
              <h2>{selectedChapter.title}</h2>
            )}
          </div>

          {loadingChapterBlocks ? (
            <div className="loading-state">
              جارٍ تحميل الفصل...
            </div>
          ) : readerBlocks.length === 0 ? (
            <div className="empty-state">
              لا يوجد محتوى في هذا الفصل بعد.
            </div>
          ) : (
            <div className="chapter-content">
              {readerBlocks.map((block) =>
                renderChapterBlock(block)
              )}
            </div>
          )}
        </article>

        {!selectedNovelAdminView && (
          <div className="chapter-navigation">
            <button
              disabled={!previousChapter}
              onClick={() => previousChapter && openChapter(previousChapter)}
            >
              ← {previousChapter ? `الفصل ${previousChapter.chapter_number}` : "لا يوجد فصل سابق"}
            </button>
            <button
              disabled={!nextChapter}
              onClick={() => nextChapter && openChapter(nextChapter)}
            >
              {nextChapter ? `الفصل ${nextChapter.chapter_number}` : "آخر فصل"} →
            </button>
          </div>
        )}

        {selectedNovelAdminView &&
          canManage &&
          renderBlockEditor()}
      </section>
    );
  }

  function renderNovelPage() {
    if (!selectedNovel) return null;

    const image = coverUrl(selectedNovel);

    return (
      <section className="novel-page">
        <button
          className="secondary-button back-button"
          onClick={goHome}
        >
          ← العودة للروايات
        </button>

        <div className="novel-hero card">
          <div className="novel-hero-cover">
            {image ? (
              <img
                src={image}
                alt={selectedNovel.title}
              />
            ) : (
              <div className="cover-placeholder large">
                <span>✦</span>
                <small>رواية</small>
              </div>
            )}
          </div>

          <div className="novel-hero-info">
            <span className="eyebrow">تفاصيل الرواية</span>

            <h1>{selectedNovel.title}</h1>

            {selectedNovel.categories?.name && (
              <button
                className="novel-category novel-category-large"
                onClick={() => {
                  setSelectedNovel(null);
                  setSelectedChapter(null);
                  setShowNovels(true);
                  setShowAccount(false);
                  setShowAdmin(false);
                  setSelectedCategoryFilter(selectedNovel.category_id || "all");
                }}
              >
                <span>التصنيف</span>
                <strong>{selectedNovel.categories.name}</strong>
              </button>
            )}

            {selectedNovel.description && (
              <p className="novel-description">
                {selectedNovel.description}
              </p>
            )}

            <div className="novel-meta large-meta">
              <span>
                {selectedNovel.status ===
                "ongoing"
                  ? "مستمرة"
                  : "مكتملة"}
              </span>

              <span>
                {selectedNovel.language}
              </span>
            </div>

            <div className="button-row">
              {user && history.some((item) => item.novel_id === selectedNovel.id) && (
                <button
                  className="primary-button"
                  onClick={() => continueReading(selectedNovel)}
                >
                  متابعة القراءة
                </button>
              )}

              {user && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    toggleFavorite(selectedNovel)
                  }
                >
                  {isFavorite(
                    selectedNovel.id
                  )
                    ? "♥ في المفضلة"
                    : "♡ إضافة للمفضلة"}
                </button>
              )}

              {selectedNovelAdminView &&
                canManage && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      editNovel(selectedNovel)
                    }
                  >
                    تعديل الرواية
                  </button>
                )}
            </div>
          </div>
        </div>

        {selectedNovelAdminView &&
          canManage &&
          renderChapterForm()}

        <div className="chapters-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                الفصول
              </span>

              <h2>
                فصول {selectedNovel.title}
              </h2>
            </div>

            {selectedNovelAdminView &&
              canManage && (
                <button
                  className="primary-button"
                  onClick={() => {
                    resetChapterForm();
                    setShowChapterForm(true);
                  }}
                >
                  + إضافة فصل
                </button>
              )}
          </div>

          {user && !selectedNovelAdminView && history.some((item) => item.novel_id === selectedNovel.id) && (
            <div className="continue-reading-banner">
              <div>
                <span className="eyebrow">متابعة القراءة</span>
                <strong>
                  {(() => {
                    const item = history.find((entry) => entry.novel_id === selectedNovel.id);
                    const chapter = chapters.find((entry) => entry.id === item?.chapter_id);
                    return chapter
                      ? `الفصل ${chapter.chapter_number}${chapter.title ? ` — ${chapter.title}` : ""}`
                      : "آخر فصل قرأته";
                  })()}
                </strong>
              </div>
              <button className="primary-button" onClick={() => continueReading(selectedNovel)}>
                متابعة
              </button>
            </div>
          )}

          {loadingChapters ? (
            <div className="loading-state">
              جارٍ تحميل الفصول...
            </div>
          ) : chapters.length === 0 ? (
            <div className="empty-state card">
              لا توجد فصول منشورة بعد.
            </div>
          ) : (
            <div className="chapter-list">
              {chapters.map((chapter) => (
                <article
                  className="chapter-card"
                  key={chapter.id}
                >
                  <button
                    className="chapter-main-button"
                    onClick={() =>
                      openChapter(chapter)
                    }
                  >
                    <span className="chapter-number">
                      الفصل{" "}
                      {chapter.chapter_number}
                    </span>

                    <span className="chapter-title">
                      {chapter.title ||
                        "بدون عنوان"}
                    </span>
                  </button>

                  {selectedNovelAdminView &&
                    canManage && (
                      <div className="chapter-actions">
                        <span
                          className={
                            chapter.published
                              ? "status-published"
                              : "status-draft"
                          }
                        >
                          {chapter.published
                            ? "منشور"
                            : "مسودة"}
                        </span>

                        <button
                          className="secondary-button"
                          onClick={() =>
                            editChapter(
                              chapter
                            )
                          }
                        >
                          تعديل
                        </button>

                        <button
                          className="secondary-button"
                          onClick={() =>
                            toggleChapterPublished(
                              chapter
                            )
                          }
                        >
                          {chapter.published
                            ? "إلغاء النشر"
                            : "نشر"}
                        </button>

                        {canManage && (
                          <button
                            className="danger-button"
                            onClick={() =>
                              deleteChapter(
                                chapter
                              )
                            }
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderAdminPage() {
    if (!canManage) return null;

    return (
      <section className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              الإدارة
            </span>

            <h1>لوحة الإدارة</h1>

            <p>
              إدارة الروايات والفصول والمشرفين.
            </p>
          </div>
        </div>

        {siteMessage && (
          <div className="message-box">
            {siteMessage}
          </div>
        )}

        <div className="admin-toolbar">
          <button
            className="primary-button"
            onClick={() => {
              resetNovelForm();
              setShowNovelForm(true);
            }}
          >
            + إضافة رواية
          </button>
        </div>

        {renderNovelForm()}

        <div className="admin-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                المكتبة
              </span>

              <h2>إدارة الروايات</h2>
            </div>

            <span className="count-badge">
              {novels.length}
            </span>
          </div>

          {novels.length === 0 ? (
            <div className="empty-state">
              لا توجد روايات بعد.
            </div>
          ) : (
            <div className="admin-novel-list">
              {novels.map((novel) => (
                <article
                  className="admin-novel-row"
                  key={novel.id}
                >
                  <div className="admin-novel-info">
                    <h3>{novel.title}</h3>

                    <div className="novel-meta">
                      {novel.categories?.name && (
                        <span>
                          {novel.categories.name}
                        </span>
                      )}

                      <span>
                        {novel.status ===
                        "ongoing"
                          ? "مستمرة"
                          : "مكتملة"}
                      </span>

                      <span
                        className={
                          novel.published
                            ? "status-published"
                            : "status-draft"
                        }
                      >
                        {novel.published
                          ? "منشورة"
                          : "مسودة"}
                      </span>
                    </div>
                  </div>

                  <div className="admin-row-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        openNovel(novel, true)
                      }
                    >
                      الفصول
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() =>
                        editNovel(novel)
                      }
                    >
                      تعديل
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() =>
                        toggleNovelPublished(
                          novel
                        )
                      }
                    >
                      {novel.published
                        ? "إلغاء النشر"
                        : "نشر"}
                    </button>

                    {isOwner && (
                      <button
                        className="danger-button"
                        onClick={() =>
                          deleteNovel(novel)
                        }
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <div className="admin-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  الصلاحيات
                </span>

                <h2>إدارة المشرفين</h2>
              </div>
            </div>

            <div className="staff-form">
              <div className="form-group">
                <label>
                  البريد الإلكتروني
                </label>

                <input
                  type="email"
                  value={staffEmail}
                  onChange={(event) =>
                    setStaffEmail(
                      event.target.value
                    )
                  }
                  placeholder="staff@email.com"
                  dir="ltr"
                />
              </div>

              <button
                className="primary-button"
                onClick={addStaff}
                disabled={managingStaff}
              >
                {managingStaff
                  ? "جارٍ التنفيذ..."
                  : "إضافة كمشرف"}
              </button>
            </div>

            {staffMessage && (
              <div className="message-box">
                {staffMessage}
              </div>
            )}

            {loadingStaff ? (
              <div className="loading-state">
                جارٍ تحميل المشرفين...
              </div>
            ) : staffMembers.length === 0 ? (
               <div className="empty-state">
                لا يوجد مشرفون حاليًا.
              </div>
            ) : (
              <div className="staff-list">
                {staffMembers.map(
                  (staff, index) => {
                    const email =
                      staff.email ||
                      staff.user_email ||
                      staff.user?.email ||
                      `مشرف ${index + 1}`;

                    return (
                      <div
                        className="staff-row"
                        key={
                          staff.id ||
                          staff.user_id ||
                          email
                        }
                      >
                        <span dir="ltr">
                          {email}
                        </span>

                        <button
                          className="danger-button"
                          onClick={() =>
                            removeStaff(
                              staff
                            )
                          }
                          disabled={
                            managingStaff
                          }
                        >
                          إزالة الصلاحية
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  function renderAccountPage() {
    if (!user) {
      return renderAuthPanel();
    }

    return (
      <section className="account-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              حسابك
            </span>

            <h1>
              {profile?.display_name ||
                user.email ||
                "القارئ"}
            </h1>

            <p>
              إدارة حسابك ومتابعة قراءتك.
            </p>
          </div>
        </div>

        <div className="account-layout">
          <aside className="account-sidebar card">
            <button
              className={
                activeSection === "profile"
                  ? "account-nav active"
                  : "account-nav"
              }
              onClick={() =>
                setActiveSection("profile")
              }
            >
              الملف الشخصي
            </button>

            <button
              className={
                activeSection === "favorites"
                  ? "account-nav active"
                  : "account-nav"
              }
              onClick={() =>
                setActiveSection("favorites")
              }
            >
              المفضلة
            </button>

            <button
              className={
                activeSection === "history"
                  ? "account-nav active"
                  : "account-nav"
              }
              onClick={() =>
                setActiveSection("history")
              }
            >
              سجل القراءة
            </button>

            <button
              className={
                activeSection ===
                "notifications"
                  ? "account-nav active"
                  : "account-nav"
              }
              onClick={() =>
                setActiveSection(
                  "notifications"
                )
              }
            >
              الإشعارات

              {unreadNotifications > 0 && (
                <span className="notification-badge">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </aside>

          <div className="account-content">
            {loadingAccountData ? (
              <div className="loading-state card">
                جارٍ تحميل الحساب...
              </div>
            ) : activeSection ===
              "profile" ? (
              <div className="account-card">
                <span className="eyebrow">
                  الملف الشخصي
                </span>

                <h2>
                  معلومات الحساب
                </h2>

                <div className="profile-info">
                  <div>
                    <span>البريد</span>
                    <strong dir="ltr">
                      {user.email}
                    </strong>
                  </div>

                  <div>
                    <span>الاسم</span>
                    <strong>
                      {profile?.display_name ||
                        "قارئ"}
                    </strong>
                  </div>

                  <div>
                    <span>الصلاحية</span>
                    <strong>
                      {profile?.role ===
                      "owner"
                        ? "المالك"
                        : profile?.role ===
                            "staff"
                          ? "مشرف"
                          : "قارئ"}
                    </strong>
                  </div>

                  {profile?.bio && (
                    <div>
                      <span>النبذة</span>
                      <p>
                        {profile.bio}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeSection ===
              "favorites" ? (
              <div className="account-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      مكتبتك
                    </span>

                    <h2>
                      الروايات المفضلة
                    </h2>
                  </div>
                </div>

                {favorites.length === 0 ? (
                  <div className="empty-state">
                    لم تضيفي أي رواية إلى
                    المفضلة بعد.
                  </div>
                ) : (
                  <div className="account-novel-list">
                    {favorites.map(
                      (favorite) => {
                        const novel =
                          publishedNovels.find(
                            (item) =>
                              item.id ===
                              favorite.novel_id
                          );

                        if (!novel) {
                          return null;
                        }

                        return (
                          <button
                            className="account-novel-item"
                            key={
                              favorite.id
                            }
                            onClick={() =>
                              openNovel(
                                novel,
                                false
                              )
                            }
                          >
                            <span>
                              {novel.title}
                            </span>

                            <span>
                              فتح →
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ) : activeSection ===
              "history" ? (
              <div className="account-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      متابعة
                    </span>

                    <h2>
                      سجل القراءة
                    </h2>
                  </div>
                </div>

                {history.length === 0 ? (
                  <div className="empty-state">
                    لا يوجد سجل قراءة بعد.
                  </div>
                ) : (
                  <div className="account-novel-list">
                    {history.map(
                      (item) => {
                        const novel =
                          publishedNovels.find(
                            (novelItem) =>
                              novelItem.id ===
                              item.novel_id
                          );

                        if (!novel) {
                          return null;
                        }

                        return (
                          <button
                            className="account-novel-item"
                            key={item.id}
                            onClick={() =>
                              openNovel(
                                novel,
                                false
                              )
                            }
                          >
                            <span>
                              {novel.title}
                            </span>

                            <span>
                              متابعة القراءة →
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="account-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      التنبيهات
                    </span>

                    <h2>
                      الإشعارات
                    </h2>
                  </div>

                  {unreadNotifications >
                    0 && (
                    <span className="count-badge">
                      {unreadNotifications}
                    </span>
                  )}
                </div>

                {notifications.length ===
                0 ? (
                  <div className="empty-state">
                    لا توجد إشعارات.
                  </div>
                ) : (
                  <div className="notification-list">
                    {notifications.map(
                      (notification) => (
                        <article
                          className={
                            notification.read_at
                              ? "notification-item"
                              : "notification-item unread"
                          }
                          key={
                            notification.id
                          }
                          onClick={() =>
                            !notification.read_at &&
                            markNotificationRead(
                              notification.id
                            )
                          }
                        >
                          <div>
                            <h3>
                              {notification.title ||
                                "إشعار"}
                            </h3>

                            {notification.message && (
                              <p>
                                {
                                  notification.message
                                }
                              </p>
                            )}

                            {notification.created_at && (
                              <small>
                                {new Date(
                                  notification.created_at
                                ).toLocaleString(
                                  "ar-SA"
                                )}
                              </small>
                            )}
                          </div>

                          {!notification.read_at && (
                            <span className="new-label">
                              جديد
                            </span>
                          )}
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell" dir="rtl">
      {renderHeader()}

      <main className="site-main">
        {selectedChapter
          ? renderChapterReader()
          : selectedNovel
            ? renderNovelPage()
            : showAdmin && canManage
              ? renderAdminPage()
              : showAccount
                ? renderAccountPage()
                : showNovels
                  ? renderHome()
                  : renderHome()}
      </main>

      <footer className="site-footer">
        <p>
          روايات خيالية © 2026
        </p>
      </footer>
    </div>
  );
}

createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);           