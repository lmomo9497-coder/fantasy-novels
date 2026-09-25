import React, { useEffect, useState } from "react";
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

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNovels, setShowNovels] = useState(true);

  const [selectedNovel, setSelectedNovel] =
    useState<Novel | null>(null);

  const [activeSection, setActiveSection] =
    useState<AccountSection>("profile");

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingAccountData, setLoadingAccountData] =
    useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] =
    useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showNovelForm, setShowNovelForm] = useState(false);
  const [savingNovel, setSavingNovel] = useState(false);
  const [editingNovelId, setEditingNovelId] =
    useState<string | null>(null);

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] =
    useState("");
  const [novelCategory, setNovelCategory] = useState("");
  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");
  const [novelLanguage, setNovelLanguage] =
    useState("العربية");
  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");
  const [novelMessage, setNovelMessage] = useState("");

  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [managingStaff, setManagingStaff] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] =
    useState(false);

  const [showChapterForm, setShowChapterForm] =
    useState(false);

  const [savingChapter, setSavingChapter] = useState(false);

  const [editingChapterId, setEditingChapterId] =
    useState<string | null>(null);

  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterMessage, setChapterMessage] = useState("");

  const [selectedChapter, setSelectedChapter] =
    useState<Chapter | null>(null);

  const [chapterBlocks, setChapterBlocks] =
    useState<ChapterBlock[]>([]);

  const [loadingChapterBlocks, setLoadingChapterBlocks] =
    useState(false);

  const [savingChapterBlocks, setSavingChapterBlocks] =
    useState(false);

  const [newBlockType, setNewBlockType] =
    useState<ChapterBlockType>("text");

  const [newBlockContent, setNewBlockContent] =
    useState("");

  const [newBlockMediaPath, setNewBlockMediaPath] =
    useState("");

  const [newBlockMediaLabel, setNewBlockMediaLabel] =
    useState("");

  const [newBlockAlign, setNewBlockAlign] =
    useState<ChapterBlock["align"]>("right");

  const [newBlockWidth, setNewBlockWidth] = useState("");
  const [newBlockHeight, setNewBlockHeight] = useState("");

  const [uploadingMedia, setUploadingMedia] =
    useState(false);

  const isOwner = profile?.role === "owner";
  const isStaff = profile?.role === "staff";
  const canManageNovels = isOwner || isStaff;

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadPublishedNovels();
    loadCategories();
  }, []);

  useEffect(() => {
    if (canManageNovels) {
      loadAdminData();
    }
  }, [profile?.role]);

  useEffect(() => {
    if (user) {
      loadAccountData();
    }
  }, [user]);

  async function loadSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUser(session?.user ?? null);

    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,display_name,avatar_url,bio,role"
      )
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
    }
  }

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("id,name,slug")
      .order("name");

    if (data) {
      setCategories(data as Category[]);
    }
  }

  async function loadPublishedNovels() {
    const { data } = await supabase
      .from("novels")
      .select(`
        id,
        title,
        slug,
        description,
        cover_path,
        category_id,
        status,
        language,
        direction,
        published,
        created_by,
        created_at,
        categories (
          id,
          name,
          slug
        )
      `)
      .eq("published", true)
      .order("created_at", {
        ascending: false,
      });

    if (data) {
      setPublishedNovels(data as Novel[]);
    }
  }

  async function loadAdminData() {
    if (!canManageNovels) return;

    const { data } = await supabase
      .from("novels")
      .select(`
        id,
        title,
        slug,
        description,
        cover_path,
        category_id,
        status,
        language,
        direction,
        published,
        created_by,
        created_at,
        categories (
          id,
          name,
          slug
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (data) {
      setNovels(data as Novel[]);
    }

    await loadCategories();

    if (isOwner) {
      await loadStaffMembers();
    }
  }

  async function loadStaffMembers() {
    if (!isOwner) return;

    setLoadingStaff(true);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "manage-staff",
          {
            body: {
              action: "list",
            },
          }
        );

      if (!error && data?.staff) {
        setStaffMembers(data.staff);
      }
    } finally {
      setLoadingStaff(false);
    }
  }

  async function loadAccountData() {
    if (!user) return;

    setLoadingAccountData(true);

    try {
      const [fav, hist, notif] = await Promise.all([
        supabase
          .from("favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("reading_progress")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      setFavorites(fav.data ?? []);
      setHistory(hist.data ?? []);
      setNotifications(notif.data ?? []);
    } finally {
      setLoadingAccountData(false);
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
    setNovelMessage("");
    setShowNovelForm(false);
  }

  function editNovel(novel: Novel) {
    setEditingNovelId(novel.id);
    setNovelTitle(novel.title);
    setNovelDescription(
      novel.description ?? ""
    );
    setNovelCategory(
      novel.categories?.name || ""
    );
    setNovelStatus(novel.status);
    setNovelLanguage(novel.language);
    setNovelDirection(novel.direction);
    setNovelMessage("");
    setShowNovelForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveNovel(publish: boolean) {
    if (!user || !canManageNovels) {
      setNovelMessage(
        "ليس لديك صلاحية لإدارة الروايات."
      );
      return;
    }

    if (!novelTitle.trim()) {
      setNovelMessage(
        "اكتبي اسم الرواية أولًا."
      );
      return;
    }

    if (!novelCategory.trim()) {
      setNovelMessage(
        "اكتبي تصنيف الرواية."
      );
      return;
    }

    setSavingNovel(true);
    setNovelMessage("");

    try {
      let categoryId: string | null = null;

      const existingCategory = categories.find(
        (category) =>
          category.name
            .trim()
            .toLowerCase() ===
          novelCategory
            .trim()
            .toLowerCase()
      );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const { data, error } =
          await supabase
            .from("categories")
            .insert({
              name: novelCategory.trim(),
              slug: makeSlug(novelCategory),
            })
            .select(
              "id,name,slug"
            )
            .single();

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        categoryId = data.id;

        setCategories((current) => [
          ...current,
          data as Category,
        ]);
      }

      if (editingNovelId) {
        const { error } =
          await supabase
            .from("novels")
            .update({
              title: novelTitle.trim(),
              description:
                novelDescription.trim() ||
                null,
              category_id: categoryId,
              status: novelStatus,
              language: novelLanguage,
              direction: novelDirection,
              published: publish,
            })
            .eq("id", editingNovelId);

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        resetNovelForm();

        await loadAdminData();
        await loadPublishedNovels();

        return;
      }

      const baseSlug =
        makeSlug(novelTitle) ||
        `novel-${Date.now()}`;

      const { error } =
        await supabase
          .from("novels")
          .insert({
            title: novelTitle.trim(),
            slug: `${baseSlug}-${Date.now()}`,
            description:
              novelDescription.trim() ||
              null,
            cover_path: null,
            category_id: categoryId,
            status: novelStatus,
            language: novelLanguage,
            direction: novelDirection,
            published: publish,
            created_by: user.id,
          });

      if (error) {
        setNovelMessage(error.message);
        return;
      }

      resetNovelForm();

      await loadAdminData();
      await loadPublishedNovels();
    } finally {
      setSavingNovel(false);
    }
  }

  async function toggleNovelPublished(
    novel: Novel
  ) {
    if (!canManageNovels) return;

    const nextPublished =
      !novel.published;

    const { error } = await supabase
      .from("novels")
      .update({
        published: nextPublished,
      })
      .eq("id", novel.id);

    if (error) {
      setNovelMessage(error.message);
      return;
    }

    await loadAdminData();
    await loadPublishedNovels();
  }

  async function deleteNovel(novel: Novel) {
    if (!isOwner) return;

    if (
      !window.confirm(
        `هل أنت متأكدة من حذف «${novel.title}»؟`
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("novels")
      .delete()
      .eq("id", novel.id);

    if (error) {
      setNovelMessage(error.message);
      return;
    }

    setNovels((current) =>
      current.filter(
        (item) => item.id !== novel.id
      )
    );

    setPublishedNovels((current) =>
      current.filter(
        (item) => item.id !== novel.id
      )
    );
  }

  async function loadChapters(
    novelId: string,
    adminView = false
  ) {
    setLoadingChapters(true);

    try {
      let query = supabase
        .from("chapters")
        .select(`
          id,
          novel_id,
          chapter_number,
          title,
          published,
          access_type,
          published_at,
          created_at,
          updated_at
        `)
        .eq("novel_id", novelId)
        .order("chapter_number", {
          ascending: true,
        });

      if (!adminView) {
        query = query.eq(
          "published",
          true
        );
      }

      const { data } = await query;

      setChapters(
        (data ?? []) as Chapter[]
      );
    } finally {
      setLoadingChapters(false);
    }
  }

  function resetChapterForm() {
    setShowChapterForm(false);
    setEditingChapterId(null);
    setChapterNumber("");
    setChapterTitle("");
    setChapterMessage("");
  }

  function editChapter(chapter: Chapter) {
    setEditingChapterId(chapter.id);
    setChapterNumber(
      String(chapter.chapter_number)
    );
    setChapterTitle(
      chapter.title ?? ""
    );
    setShowChapterForm(true);
  }

  async function saveChapter(
    publish: boolean
  ) {
    if (
      !selectedNovel ||
      !user ||
      !canManageNovels
    ) {
      return;
    }

    const number =
      Number(chapterNumber);

    if (
      !Number.isInteger(number) ||
      number <= 0
    ) {
      setChapterMessage(
        "اكتبي رقم فصل صحيحًا."
      );
      return;
    }

    if (!chapterTitle.trim()) {
      setChapterMessage(
        "اكتبي عنوان الفصل."
      );
      return;
    }

    setSavingChapter(true);

    try {
      const chapterData = {
        novel_id: selectedNovel.id,
        chapter_number: number,
        title: chapterTitle.trim(),
        published: publish,
        access_type: "free",
        published_at: publish
          ? new Date().toISOString()
          : null,
        updated_at:
          new Date().toISOString(),
      };

      const result = editingChapterId
        ? await supabase
            .from("chapters")
            .update(chapterData)
            .eq(
              "id",
              editingChapterId
            )
        : await supabase
            .from("chapters")
            .insert(chapterData);

      if (result.error) {
        setChapterMessage(
          result.error.message
        );
        return;
      }

      resetChapterForm();

      await loadChapters(
        selectedNovel.id,
        true
      );
    } finally {
      setSavingChapter(false);
    }
  }

  async function toggleChapterPublished(
    chapter: Chapter
  ) {
    const next =
      !chapter.published;

    const { error } =
      await supabase
        .from("chapters")
        .update({
          published: next,
          published_at: next
            ? new Date().toISOString()
            : null,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          chapter.id
        );

    if (error) {
      setChapterMessage(
        error.message
      );
      return;
    }

    await loadChapters(
      selectedNovel!.id,
      true
    );
  }

  async function deleteChapter(
    chapter: Chapter
  ) {
    if (!isOwner) return;

    if (
      !window.confirm(
        `هل أنت متأكدة من حذف الفصل ${chapter.chapter_number}؟`
      )
    ) {
      return;
    }

    const { error } =
      await supabase
        .from("chapters")
        .delete()
        .eq(
          "id",
          chapter.id
        );

    if (error) {
      setChapterMessage(
        error.message
      );
      return;
    }

    setChapters((current) =>
      current.filter(
        (item) =>
          item.id !== chapter.id
      )
    );

    if (
      selectedChapter?.id ===
      chapter.id
    ) {
      closeChapterEditor();
    }
  }

  async function loadChapterBlocks(
    chapterId: string
  ) {
    setLoadingChapterBlocks(true);

    try {
      const { data, error } =
        await supabase
          .from("chapter_blocks")
          .select(`
            id,
            chapter_id,
            block_order,
            block_type,
            content,
            media_path,
            media_label,
            align,
            width,
            height
          `)
          .eq(
            "chapter_id",
            chapterId
          )
          .order(
            "block_order",
            {
              ascending: true,
            }
          );

      if (error) {
        alert(error.message);
        setChapterBlocks([]);
        return;
      }

      setChapterBlocks(
        (data ?? []) as ChapterBlock[]
      );
    } finally {
      setLoadingChapterBlocks(false);
    }
  }

  function resetBlockForm() {
    setNewBlockType("text");
    setNewBlockContent("");
    setNewBlockMediaPath("");
    setNewBlockMediaLabel("");
    setNewBlockAlign("right");
    setNewBlockWidth("");
    setNewBlockHeight("");
  }

  async function uploadChapterMedia(
    file: File
  ) {
    if (!file || !selectedChapter) {
      return;
    }

    if (
      newBlockType === "gif" &&
      file.type !== "image/gif"
    ) {
      alert(
        "اختاري ملف GIF فقط لهذا النوع."
      );
      return;
    }

    if (
      newBlockType === "image" &&
      !file.type.startsWith("image/")
    ) {
      alert(
        "اختاري ملف صورة."
      );
      return;
    }

    if (
      newBlockType === "audio" &&
      !file.type.startsWith("audio/")
    ) {
      alert(
        "اختاري ملف صوتي."
      );
      return;
    }

    const isAudio =
      newBlockType === "audio";

    const bucket = isAudio
      ? "audio"
      : "chapter-media";

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "bin";

    const path =
      `${selectedChapter.id}/` +
      `${makeStorageId()}.${extension}`;

    setUploadingMedia(true);

    try {
      const { error } =
        await supabase.storage
          .from(bucket)
          .upload(
            path,
            file,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                file.type ||
                undefined,
            }
          );

      if (error) {
        alert(
          `فشل رفع الملف:\n${error.message}`
        );
        return;
      }

      const { data } =
        supabase.storage
          .from(bucket)
          .getPublicUrl(path);

      if (!data.publicUrl) {
        alert(
          "تم رفع الملف لكن تعذر الحصول على الرابط."
        );
        return;
      }

      setNewBlockMediaPath(
        data.publicUrl
      );
    } finally {
      setUploadingMedia(false);
    }
  }

  async function addChapterBlock() {
    if (!selectedChapter) {
      return;
    }

    const textType =
      newBlockType === "text" ||
      newBlockType === "heading" ||
      newBlockType === "quote";

    const mediaType =
      newBlockType === "image" ||
      newBlockType === "gif" ||
      newBlockType === "audio";

    if (
      textType &&
      !newBlockContent.trim()
    ) {
      alert(
        "اكتبي المحتوى أولًا."
      );
      return;
    }

    if (
      mediaType &&
      !newBlockMediaPath.trim()
    ) {
      alert(
        "ارفعي الملف أولًا."
      );
      return;
    }

    const order =
      chapterBlocks.length > 0
        ? Math.max(
            ...chapterBlocks.map(
              (b) => b.block_order
            )
          ) + 1
        : 1;

    setSavingChapterBlocks(true);

    try {
      const width =
        newBlockWidth.trim()
          ? Number(newBlockWidth)
          : null;

      const height =
        newBlockHeight.trim()
          ? Number(newBlockHeight)
          : null;

      const { data, error } =
        await supabase
          .from("chapter_blocks")
          .insert({
            chapter_id:
              selectedChapter.id,
            block_order: order,
            block_type:
              newBlockType,
            content:
              newBlockContent.trim() ||
              null,
            media_path:
              newBlockMediaPath.trim() ||
              null,
            media_label:
              newBlockMediaLabel.trim() ||
              null,
            align:
              newBlockAlign,
            width,
            height,
          })
          .select(`
            id,
            chapter_id,
            block_order,
            block_type,
            content,
            media_path,
            media_label,
            align,
            width,
            height
          `)
          .single();

      if (error) {
        alert(error.message);
        return;
      }

      setChapterBlocks(
        (current) => [
          ...current,
          data as ChapterBlock,
        ]
      );

      resetBlockForm();
    } finally {
      setSavingChapterBlocks(false);
    }
  }

  async function deleteChapterBlock(
    block: ChapterBlock
  ) {
    if (!isOwner) return;

    if (
      !window.confirm(
        "هل أنت متأكدة من حذف هذا العنصر؟"
      )
    ) {
      return;
    }

    const { error } =
      await supabase
        .from("chapter_blocks")
        .delete()
        .eq(
          "id",
          block.id
        );

    if (error) {
      alert(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.filter(
        (item) =>
          item.id !== block.id
      )
    );
  }

  async function moveChapterBlock(
    block: ChapterBlock,
    direction: "up" | "down"
  ) {
    const index =
      chapterBlocks.findIndex(
        (b) => b.id === block.id
      );

    if (index < 0) return;

    const newIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      newIndex < 0 ||
      newIndex >=
        chapterBlocks.length
    ) {
      return;
    }

    const target =
      chapterBlocks[newIndex];

    setSavingChapterBlocks(true);

    try {
      await supabase
        .from("chapter_blocks")
        .update({
          block_order: -Date.now(),
        })
        .eq(
          "id",
          block.id
        );

      await supabase
        .from("chapter_blocks")
        .update({
          block_order:
            block.block_order,
        })
        .eq(
          "id",
          target.id
        );

      await supabase
        .from("chapter_blocks")
        .update({
          block_order:
            target.block_order,
        })
        .eq(
          "id",
          block.id
        );

      await loadChapterBlocks(
        selectedChapter!.id
      );
    } finally {
      setSavingChapterBlocks(false);
    }
  }

  function openChapterEditor(
    chapter: Chapter
  ) {
    setSelectedChapter(chapter);
    setChapterBlocks([]);
    resetBlockForm();

    loadChapterBlocks(
      chapter.id
    );
  }

  function closeChapterEditor() {
    setSelectedChapter(null);
    setChapterBlocks([]);
    resetBlockForm();
  }

  function getBlockTypeLabel(
    type: ChapterBlockType
  ) {
    const labels: Record<
      ChapterBlockType,
      string
    > = {
      text: "📝 نص",
      heading: "🔤 عنوان",
      image: "🖼️ صورة",
      gif: "🎞️ GIF",
      audio: "🎧 صوت",
      quote: "💬 اقتباس",
      divider: "─ فاصل",
    };

    return labels[type];
  }

  function renderChapterBlock(
    block: ChapterBlock
  ) {
    const style: React.CSSProperties = {
      textAlign:
        block.align === "full"
          ? "center"
          : block.align,
    };

    switch (block.block_type) {
      case "heading":
        return (
          <h2 style={style}>
            {block.content}
          </h2>
        );

      case "text":
        return (
          <p
            style={{
              ...style,
              lineHeight: 2.1,
              whiteSpace:
                "pre-wrap",
            }}
          >
            {block.content}
          </p>
        );

      case "quote":
        return (
          <blockquote
            style={{
              ...style,
              lineHeight: 2,
            }}
          >
            {block.content}
          </blockquote>
        );

      case "divider":
        return (
          <hr
            style={{
              margin: "30px 0",
            }}
          />
        );

      case "image":
      case "gif":
        return block.media_path ? (
          <div style={style}>
            <img
              src={
                block.media_path
              }
              alt={
                block.content || ""
              }
              style={{
                width:
                  block.width
                    ? `${block.width}px`
                    : "auto",
                height:
                  block.height
                    ? `${block.height}px`
                    : "auto",
                maxWidth: "100%",
                objectFit:
                  "contain",
              }}
            />
          </div>
        ) : null;

      case "audio":
        return block.media_path ? (
          <div style={style}>
            {block.media_label && (
              <p>
                <strong>
                  {
                    block.media_label
                  }
                </strong>
              </p>
            )}

            <audio
              controls
              preload="none"
              src={
                block.media_path
              }
              style={{
                width: "100%",
              }}
            />
          </div>
        ) : null;

      default:
        return null;
    }
  }

  async function addStaff() {
    if (
      !isOwner ||
      !staffEmail.trim()
    ) {
      return;
    }

    setManagingStaff(true);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "manage-staff",
          {
            body: {
              action: "set_role",
              email:
                staffEmail.trim(),
              role: "staff",
            },
          }
        );

      if (error) {
        setStaffMessage(
          error.message
        );
        return;
      }

      if (data?.error) {
        setStaffMessage(
          data.error
        );
        return;
      }

      setStaffEmail("");
      setStaffMessage(
        "تمت إضافة المشرف بنجاح."
      );

      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function removeStaff(
    staff: any
  ) {
    if (!isOwner) return;

    if (
      !window.confirm(
        "هل تريدين إزالة صلاحية المشرف؟"
      )
    ) {
      return;
    }

    setManagingStaff(true);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "manage-staff",
          {
            body: {
              action: "set_role",
              email: staff.email,
              role: "reader",
            },
          }
        );

      if (error) {
        setStaffMessage(
          error.message
        );
        return;
      }

      if (data?.error) {
        setStaffMessage(
          data.error
        );
        return;
      }

      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth(
      {
        provider: "google",
        options: {
          redirectTo:
            window.location.origin,
        },
      }
    );
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setShowAccount(false);
    setShowAdmin(false);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setChapterBlocks([]);
    setChapters([]);

    resetNovelForm();
    resetChapterForm();
    resetBlockForm();
  }

  async function markNotificationRead(
    id: string
  ) {
    const now =
      new Date().toISOString();

    await supabase
      .from("notifications")
      .update({
        read_at: now,
      })
      .eq(
        "id",
        id
      );

    setNotifications(
      (current) =>
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

  async function openNovel(
    novel: Novel,
    adminView = false
  ) {
    setSelectedNovel(novel);
    setSelectedChapter(null);
    setChapterBlocks([]);
    setShowNovels(false);

    await loadChapters(
      novel.id,
      adminView &&
        canManageNovels
    );
  }

  function backToNovels() {
    setSelectedNovel(null);
    setSelectedChapter(null);
    setChapterBlocks([]);
    setChapters([]);

    resetChapterForm();
    resetBlockForm();

    setShowNovels(true);
  }

  const unreadNotifications =
    notifications.filter(
      (item) =>
        !item.read_at
    ).length;

  return (
    <div
      dir="rtl"
      className="app"
    >
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => {
              setShowAccount(false);
              setShowAdmin(false);
              setSelectedNovel(null);
              setSelectedChapter(null);
              setChapterBlocks([]);
              setChapters([]);
              setShowNovels(true);
            }}
          >
            <strong>
              روايات خيالية
            </strong>

            <span>
              عالم من الحكايات
            </span>
          </button>

          <nav className="main-nav">
            <button
              className={
                showNovels
                  ? "active"
                  : ""
              }
              onClick={() => {
                setShowNovels(true);
                setShowAccount(false);
                setShowAdmin(false);
                setSelectedNovel(null);
                setSelectedChapter(null);
                setChapterBlocks([]);
                setChapters([]);
              }}
            >
              الروايات
            </button>

            {user && (
              <button
                className={
                  showAccount
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                }}
              >
                حسابي

                {unreadNotifications >
                  0 && (
                  <span className="notification-badge">
                    {
                      unreadNotifications
                    }
                  </span>
                )}
              </button>
            )}

            {canManageNovels && (
              <button
                className={
                  showAdmin
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setShowAdmin(true);
                  setShowAccount(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                  setSelectedChapter(null);
                  setChapterBlocks([]);
                  setChapters([]);
                }}
              >
                الإدارة
              </button>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <button
                className="account-button"
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                }}
              >
                {profile?.display_name ||
                  user.email ||
                  "حسابي"}
              </button>
            ) : (
              <button
                className="account-button"
                onClick={
                  loginWithGoogle
                }
              >
                تسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {selectedNovel ? (
          <section className="novel-reader">
            <button
              className="back-button"
              onClick={
                backToNovels
              }
            >
              ← العودة للروايات
            </button>

            <div className="novel-detail">
              <div className="novel-cover-large">
                {selectedNovel.cover_path ? (
                  <img
                    src={
                      selectedNovel.cover_path
                    }
                    alt={
                      selectedNovel.title
                    }
                  />
                ) : (
                  <div className="cover-placeholder">
                    📖
                  </div>
                )}
              </div>

              <div className="novel-detail-content">
                <span className="novel-category">
                  {selectedNovel.categories
                    ?.name ||
                    "رواية"}
                </span>

                <h1>
                  {
                    selectedNovel.title
                  }
                </h1>

                <p>
                  {selectedNovel.description ||
                    "لا يوجد وصف لهذه الرواية حاليًا."}
                </p>

                <div className="novel-meta">
                  <span>
                    {selectedNovel.status ===
                    "completed"
                      ? "مكتملة"
                      : "مستمرة"}
                  </span>

                  <span>
                    {
                      selectedNovel.language
                    }
                  </span>
                </div>
              </div>
            </div>

            <div
              className="account-card"
              style={{
                marginTop: 25,
              }}
            >
              <div className="admin-heading-row">
                <div>
                  <h2>
                    📚 الفصول
                  </h2>

                  <p>
                    {canManageNovels &&
                    showAdmin
                      ? "إدارة فصول الرواية ومحتواها."
                      : "الفصول المنشورة فقط."}
                  </p>
                </div>

                {canManageNovels &&
                  showAdmin && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        if (
                          showChapterForm
                        ) {
                          resetChapterForm();
                        } else {
                          setEditingChapterId(
                            null
                          );
                          setChapterNumber(
                            ""
                          );
                          setChapterTitle(
                            ""
                          );
                          setShowChapterForm(
                            true
                          );
                        }
                      }}
                    >
                      {showChapterForm
                        ? "إلغاء"
                        : "+ إضافة فصل"}
                    </button>
                  )}
              </div>

              {canManageNovels &&
                showAdmin &&
                showChapterForm && (
                  <div className="panel novel-form">
                    <h3>
                      {editingChapterId
                        ? "✏️ تعديل الفصل"
                        : "إضافة فصل جديد"}
                    </h3>

                    <label>
                      رقم الفصل

                      <input
                        type="number"
                        min="1"
                        value={
                          chapterNumber
                        }
                        onChange={(e) =>
                          setChapterNumber(
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      عنوان الفصل

                      <input
                        value={
                          chapterTitle
                        }
                        onChange={(e) =>
                          setChapterTitle(
                            e.target.value
                          )
                        }
                      />
                    </label>

                    {chapterMessage && (
                      <div className="panel">
                        {
                          chapterMessage
                        }
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        className="secondary-button"
                        disabled={
                          savingChapter
                        }
                        onClick={() =>
                          saveChapter(
                            false
                          )
                        }
                      >
                        📝 حفظ كمسودة
                      </button>

                      <button
                        className="primary-button"
                        disabled={
                          savingChapter
                        }
                        onClick={() =>
                          saveChapter(
                            true
                          )
                        }
                      >
                        🟢 حفظ ونشر
                      </button>
                    </div>
                  </div>
                )}

              {loadingChapters ? (
                <div className="account-loading">
                  جارٍ تحميل الفصول...
                </div>
              ) : chapters.length ===
                0 ? (
                <div className="panel">
                  لا توجد فصول حاليًا.
                </div>
              ) : (
                <div className="account-list">
                  {chapters.map(
                    (chapter) => (
                      <div
                        className="account-novel"
                        key={
                          chapter.id
                        }
                      >
                        <div className="novel-list-info">
                          <h3>
                            الفصل{" "}
                            {
                              chapter.chapter_number
                            }

                            {chapter.title
                              ? ` — ${chapter.title}`
                              : ""}
                          </h3>

                          <span>
                            مجاني
                          </span>

                          <small>
                            {chapter.published
                              ? "🟢 منشور"
                              : "📝 مسودة"}
                          </small>
                        </div>

                        <div className="novel-list-actions">
                          <button
                            className="primary-button"
                            onClick={() =>
                              openChapterEditor(
                                chapter
                              )
                            }
                          >
                            {canManageNovels &&
                            showAdmin
                              ? "✏️ تحرير المحتوى"
                              : "📖 قراءة"}
                          </button>

                          {canManageNovels &&
                            showAdmin && (
                              <>
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    editChapter(
                                      chapter
                                    )
                                  }
                                >
                                  ✏️ تعديل البيانات
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
                                    ? "⚪ إلغاء النشر"
                                    : "🟢 نشر الفصل"}
                                </button>

                                {isOwner && (
                                  <button
                                    className="danger-button"
                                    onClick={() =>
                                      deleteChapter(
                                        chapter
                                      )
                                    }
                                  >
                                    🗑️ حذف
                                  </button>
                                )}
                              </>
                            )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {selectedChapter && (
              <div
                className="account-card"
                style={{
                  marginTop: 25,
                }}
              >
                <div className="admin-heading-row">
                  <div>
                    <span>
                      {canManageNovels &&
                      showAdmin
                        ? "محرر الفصل"
                        : "القراءة"}
                    </span>

                    <h2>
                      الفصل{" "}
                      {
                        selectedChapter.chapter_number
                      }

                      {selectedChapter.title
                        ? ` — ${selectedChapter.title}`
                        : ""}
                    </h2>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={
                      closeChapterEditor
                    }
                  >
                    إغلاق
                  </button>
                </div>

                {loadingChapterBlocks ? (
                  <div className="account-loading">
                    جارٍ تحميل محتوى الفصل...
                  </div>
                ) : canManageNovels &&
                  showAdmin ? (
                  <>
                    <div className="panel">
                      <h3>
                        ➕ إضافة عنصر إلى الفصل
                      </h3>

                      <label>
                        نوع العنصر

                        <select
                          value={
                            newBlockType
                          }
                          onChange={(e) =>
                            setNewBlockType(
                              e.target.value as ChapterBlockType
                            )
                          }
                        >
                          <option value="text">
                            📝 نص
                          </option>

                          <option value="heading">
                            🔤 عنوان
                          </option>

                          <option value="quote">
                            💬 اقتباس
                          </option>

                          <option value="divider">
                            ─ فاصل
                          </option>

                          <option value="image">
                            🖼️ صورة
                          </option>

                          <option value="gif">
                            🎞️ GIF
                          </option>

                          <option value="audio">
                            🎧 صوت
                          </option>
                        </select>
                      </label>

                      {(newBlockType ===
                        "text" ||
                        newBlockType ===
                          "heading" ||
                        newBlockType ===
                          "quote") && (
                        <label>
                          المحتوى

                          <textarea
                            value={
                              newBlockContent
                            }
                            onChange={(e) =>
                              setNewBlockContent(
                                e.target.value
                              )
                            }
                            rows={6}
                          />
                        </label>
                      )}

                      {(newBlockType ===
                        "image" ||
                        newBlockType ===
                          "gif" ||
                        newBlockType ===
                          "audio") && (
                        <>
                          <label>
                            رفع الملف

                            <input
                              type="file"
                              accept={
                                newBlockType ===
                                "audio"
                                  ? "audio/*"
                                  : newBlockType ===
                                    "gif"
                                  ? "image/gif"
                                  : "image/*"
                              }
                              disabled={
                                uploadingMedia
                              }
                              onChange={(e) => {
                                const file =
                                  e.target
                                    .files?.[0];

                                if (file) {
                                  uploadChapterMedia(
                                    file
                                  );
                                }

                                e.target.value =
                                  "";
                              }}
                            />
                          </label>

                          {uploadingMedia && (
                            <div className="panel">
                              ⏳ جارٍ رفع الملف...
                            </div>
                          )}

                          {newBlockMediaPath && (
                            <div className="panel">
                              ✅ تم رفع الملف بنجاح.

                              <div
                                style={{
                                  marginTop:
                                    8,
                                  wordBreak:
                                    "break-all",
                                  fontSize:
                                    12,
                                  opacity:
                                    0.7,
                                }}
                              >
                                {
                                  newBlockMediaPath
                                }
                              </div>
                            </div>
                          )}

                          {newBlockType ===
                            "audio" && (
                            <label>
                              اسم الصوت

                              <input
                                value={
                                  newBlockMediaLabel
                                }
                                onChange={(e) =>
                                  setNewBlockMediaLabel(
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: صوت المطر"
                              />
                            </label>
                          )}

                          {(newBlockType ===
                            "image" ||
                            newBlockType ===
                              "gif") && (
                            <>
                              <label>
                                وصف الصورة
                                <input
                                  value={
                                    newBlockContent
                                  }
                                  onChange={(e) =>
                                    setNewBlockContent(
                                      e.target.value
                                    )
                                  }
                                  placeholder="وصف اختياري للصورة"
                                />
                              </label>

                              <label>
                                عرض الصورة بالبكسل

                                <input
                                  type="number"
                                  min="1"
                                  value={
                                    newBlockWidth
                                  }
                                  onChange={(e) =>
                                    setNewBlockWidth(
                                      e.target.value
                                    )
                                  }
                                  placeholder="مثال: 700"
                                />
                              </label>

                              <label>
                                ارتفاع الصورة بالبكسل

                                <input
                                  type="number"
                                  min="1"
                                  value={
                                    newBlockHeight
                                  }
                                  onChange={(e) =>
                                    setNewBlockHeight(
                                      e.target.value
                                    )
                                  }
                                  placeholder="مثال: 500"
                                />
                              </label>

                              <label>
                                المحاذاة

                                <select
                                  value={
                                    newBlockAlign
                                  }
                                  onChange={(e) =>
                                    setNewBlockAlign(
                                      e.target.value as ChapterBlock["align"]
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
                                    كامل
                                  </option>
                                </select>
                              </label>
                            </>
                          )}
                        </>
                      )}

                      <div className="form-actions">
                        <button
                          className="primary-button"
                          disabled={
                            savingChapterBlocks ||
                            uploadingMedia
                          }
                          onClick={
                            addChapterBlock
                          }
                        >
                          {savingChapterBlocks
                            ? "جارٍ الحفظ..."
                            : "➕ إضافة العنصر"}
                        </button>

                        <button
                          className="secondary-button"
                          onClick={
                            resetBlockForm
                          }
                        >
                          مسح
                        </button>
                      </div>
                    </div>

                    <div
                      className="panel"
                      style={{
                        marginTop: 20,
                      }}
                    >
                      <h3>
                        📑 محتوى الفصل
                      </h3>

                      {chapterBlocks.length ===
                      0 ? (
                        <p>
                          لم تتم إضافة أي محتوى للفصل بعد.
                        </p>
                      ) : (
                        chapterBlocks.map(
                          (
                            block,
                            index
                          ) => (
                            <div
                              className="account-novel"
                              key={
                                block.id
                              }
                              style={{
                                marginBottom:
                                  15,
                                display:
                                  "block",
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "center",
                                  gap: 10,
                                  flexWrap:
                                    "wrap",
                                }}
                              >
                                <strong>
                                  {index +
                                    1}{" "}
                                  —{" "}
                                  {getBlockTypeLabel(
                                    block.block_type
                                  )}
                                </strong>

                                <div className="novel-list-actions">
                                  <button
                                    className="secondary-button"
                                    disabled={
                                      savingChapterBlocks ||
                                      index ===
                                        0
                                    }
                                    onClick={() =>
                                      moveChapterBlock(
                                        block,
                                        "up"
                                      )
                                    }
                                  >
                                    ↑
                                  </button>

                                  <button
                                    className="secondary-button"
                                    disabled={
                                      savingChapterBlocks ||
                                      index ===
                                        chapterBlocks.length -
                                          1
                                    }
                                    onClick={() =>
                                      moveChapterBlock(
                                        block,
                                        "down"
                                      )
                                    }
                                  >
                                    ↓
                                  </button>

                                  {isOwner && (
                                    <button
                                      className="danger-button"
                                      onClick={() =>
                                        deleteChapterBlock(
                                          block
                                        )
                                      }
                                    >
                                      🗑️ حذف
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div
                                style={{
                                  marginTop: 15,
                                }}
                              >
                                {renderChapterBlock(
                                  block
                                )}
                              </div>
                            </div>
                          )
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    className="panel"
                    style={{
                      lineHeight: 2,
                    }}
                  >
                    {chapterBlocks.length ===
                    0 ? (
                      <p>
                        لا يوجد محتوى منشور لهذا الفصل حاليًا.
                      </p>
                    ) : (
                      chapterBlocks.map(
                        (block) => (
                          <div
                            key={
                              block.id
                            }
                            style={{
                              marginBottom:
                                25,
                            }}
                          >
                            {renderChapterBlock(
                              block
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : showAdmin &&
          canManageNovels ? (
          <section className="account-page">
            <div className="page-heading">
              <span>
                لوحة الإدارة
              </span>

              <h1>
                إدارة الروايات
              </h1>

              <p>
                إدارة الروايات والفصول والمحتوى.
              </p>
            </div>

            <div className="account-card">
              <div className="admin-heading-row">
                <div>
                  <h2>
                    الروايات
                  </h2>

                  <p>
                    المسودة لا تظهر للقراء.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => {
                    if (
                      showNovelForm
                    ) {
                      resetNovelForm();
                    } else {
                      setEditingNovelId(
                        null
                      );

                      setNovelTitle(
                        ""
                      );

                      setNovelDescription(
                        ""
                      );

                      setNovelCategory(
                        ""
                      );

                      setShowNovelForm(
                        true
                      );
                    }
                  }}
                >
                  {showNovelForm
                    ? "إلغاء"
                    : "+ إضافة رواية"}
                </button>
              </div>

              {showNovelForm && (
                <div className="panel novel-form">
                  <h3>
                    {editingNovelId
                      ? "✏️ تعديل الرواية"
                      : "إضافة رواية جديدة"}
                  </h3>

                  <label>
                    اسم الرواية

                    <input
                      value={
                        novelTitle
                      }
                      onChange={(e) =>
                        setNovelTitle(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    الوصف

                    <textarea
                      value={
                        novelDescription
                      }
                      onChange={(e) =>
                        setNovelDescription(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    التصنيف

                    <input
                      value={
                        novelCategory
                      }
                      onChange={(e) =>
                        setNovelCategory(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    الحالة

                    <select
                      value={
                        novelStatus
                      }
                      onChange={(e) =>
                        setNovelStatus(
                          e.target.value as
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
                  </label>

                  <label>
                    اللغة

                    <input
                      value={
                        novelLanguage
                      }
                      onChange={(e) =>
                        setNovelLanguage(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    اتجاه القراءة

                    <select
                      value={
                        novelDirection
                      }
                      onChange={(e) =>
                        setNovelDirection(
                          e.target.value as
                            | "rtl"
                            | "ltr"
                        )
                      }
                    >
                      <option value="rtl">
                        من اليمين لليسار
                      </option>

                      <option value="ltr">
                        من اليسار لليمين
                      </option>
                    </select>
                  </label>

                  {novelMessage && (
                    <div className="panel">
                      {
                        novelMessage
                      }
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      disabled={
                        savingNovel
                      }
                      onClick={() =>
                        saveNovel(
                          false
                        )
                      }
                    >
                      📝 حفظ كمسودة
                    </button>

                    <button
                      className="primary-button"
                      disabled={
                        savingNovel
                      }
                      onClick={() =>
                        saveNovel(
                          true
                        )
                      }
                    >
                      🟢 حفظ ونشر
                    </button>
                  </div>
                </div>
              )}

              <div className="account-list">
                {novels.map(
                  (novel) => (
                    <div
                      className="account-novel"
                      key={
                        novel.id
                      }
                    >
                      <div className="novel-list-info">
                        <h3>
                          {
                            novel.title
                          }
                        </h3>

                        <span>
                          {novel.categories
                            ?.name ||
                            "بدون تصنيف"}
                        </span>

                        <small>
                          {novel.published
                            ? "🟢 منشورة"
                            : "📝 مسودة"}
                        </small>
                      </div>

                      <div className="novel-list-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            editNovel(
                              novel
                            )
                          }
                        >
                          ✏️ تعديل
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
                            ? "⚪ إلغاء النشر"
                            : "🟢 نشر الرواية"}
                        </button>

                        <button
                          className="primary-button"
                          onClick={() =>
                            openNovel(
                              novel,
                              true
                            )
                          }
                        >
                          📚 الفصول
                        </button>

                        {isOwner && (
                          <button
                            className="danger-button"
                            onClick={() =>
                              deleteNovel(
                                novel
                              )
                            }
                          >
                            🗑️ حذف
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {isOwner && (
              <div className="account-card">
                <h2>
                  👥 إدارة المشرفين
                </h2>

                <div className="panel">
                  <label>
                    بريد المستخدم

                    <input
                      type="email"
                      value={
                        staffEmail
                      }
                      onChange={(e) =>
                        setStaffEmail(
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <button
                    className="primary-button"
                    disabled={
                      managingStaff
                    }
                    onClick={
                      addStaff
                    }
                  >
                    إضافة كمشرف
                  </button>

                  {staffMessage && (
                    <div className="panel">
                      {
                        staffMessage
                      }
                    </div>
                  )}
                </div>

                {loadingStaff ? (
                  <div className="account-loading">
                    جارٍ تحميل المشرفين...
                  </div>
                ) : (
                  <div className="account-list">
                    {staffMembers.map(
                      (staff) => (
                        <div
                          className="account-novel"
                          key={
                            staff.id
                          }
                        >
                          <div className="novel-list-info">
                            <h3>
                              {staff.display_name ||
                                "مشرف"}
                            </h3>

                            <span>
                              {staff.email ||
                                "بريد غير متوفر"}
                            </span>
                          </div>

                          <button
                            className="danger-button"
                            onClick={() =>
                              removeStaff(
                                staff
                              )
                            }
                          >
                            إزالة الصلاحية
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : showAccount &&
          user ? (
          <section className="account-page">
            <div className="page-heading">
              <span>
                حسابك
              </span>

              <h1>
                مرحبًا{" "}
                {profile?.display_name ||
                  user.email?.split(
                    "@"
                  )[0] ||
                  ""}
              </h1>
            </div>

            <div className="account-layout">
              <aside className="account-sidebar">
                <button
                  className={
                    activeSection ===
                    "profile"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection(
                      "profile"
                    )
                  }
                >
                  الملف الشخصي
                </button>

                <button
                  className={
                    activeSection ===
                    "favorites"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection(
                      "favorites"
                    )
                  }
                >
                  المفضلة
                </button>

                <button
                  className={
                    activeSection ===
                    "history"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection(
                      "history"
                    )
                  }
                >
                  سجل القراءة
                </button>

                <button
                  className={
                    activeSection ===
                    "notifications"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection(
                      "notifications"
                    )
                  }
                >
                  الإشعارات
                </button>

                <button
                  onClick={logout}
                >
                  تسجيل الخروج
                </button>
              </aside>

              <div className="account-content">
                {loadingAccountData ? (
                  <div className="account-loading">
                    جارٍ تحميل الحساب...
                  </div>
                ) : (
                  <>
                    {activeSection ===
                      "profile" && (
                      <div className="account-card">
                        <h2>
                          الملف الشخصي
                        </h2>

                        <div className="profile-header">
                          <div className="profile-avatar">
                            {(
                              profile?.display_name ||
                              user.email ||
                              "م"
                            )[0]}
                          </div>

                          <div>
                            <h3>
                              {profile?.display_name ||
                                "قارئ"}
                            </h3>

                            <p>
                              {
                                user.email
                              }
                            </p>

                            <small>
                              الصلاحية:{" "}
                              {profile?.role ===
                              "owner"
                                ? "المالك"
                                : profile?.role ===
                                  "staff"
                                ? "مشرف"
                                : "قارئ"}
                            </small>
                          </div>
                        </div>

                        {profile?.bio && (
                          <p>
                            {
                              profile.bio
                            }
                          </p>
                        )}
                      </div>
                    )}

                    {activeSection ===
                      "favorites" && (
                      <div className="account-card">
                        <h2>
                          المفضلة
                        </h2>

                        <div className="panel">
                          {favorites.length
                            ? `لديك ${favorites.length} رواية في المفضلة.`
                            : "لا توجد روايات في المفضلة حاليًا."}
                        </div>
                      </div>
                    )}

                    {activeSection ===
                      "history" && (
                      <div className="account-card">
                        <h2>
                          سجل القراءة
                        </h2>

                        <div className="panel">
                          {history.length
                            ? `لديك ${history.length} سجل قراءة.`
                            : "لم تبدأ قراءة أي رواية بعد."}
                        </div>
                      </div>
                    )}

                    {activeSection ===
                      "notifications" && (
                      <div className="account-card">
                        <h2>
                          الإشعارات
                        </h2>

                        {notifications.length ===
                        0 ? (
                          <div className="panel">
                            لا توجد إشعارات.
                          </div>
                        ) : (
                          <div className="account-list">
                            {notifications.map(
                              (
                                notification
                              ) => (
                                <button
                                  className="account-novel"
                                  key={
                                    notification.id
                                  }
                                  onClick={() =>
                                    markNotificationRead(
                                      notification.id
                                    )
                                  }
                                >
                                  <div>
                                    <strong>
                                      {
                                        notification.title ||
                                        "إشعار"
                                      }
                                    </strong>

                                    <p>
                                      {
                                        notification.message
                                      }
                                    </p>
                                  </div>

                                  {!notification.read_at && (
                                    <span className="notification-badge">
                                      جديد
                                    </span>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="novels-page">
            <div className="hero">
              <span>
                عالم الروايات
              </span>

              <h1>
                اقرئي حكايتك القادمة
              </h1>

              <p>
                اكتشفي الروايات المنشورة واقرئيها في مكان واحد.
              </p>
            </div>

            <div className="novels-section">
              <div className="section-heading">
                <div>
                  <span>
                    المكتبة
                  </span>

                  <h2>
                    الروايات
                  </h2>
                </div>
              </div>

              {publishedNovels.length ===
              0 ? (
                <div className="panel">
                  لا توجد روايات منشورة حاليًا.
                </div>
              ) : (
                <div className="novels-grid">
                  {publishedNovels.map(
                    (novel) => (
                      <article
                        className="novel-card"
                        key={
                          novel.id
                        }
                        onClick={() =>
                          openNovel(
                            novel,
                            false
                          )
                        }
                      >
                        <div className="novel-cover">
                          {novel.cover_path ? (
                            <img
                              src={
                                novel.cover_path
                              }
                              alt={
                                novel.title
                              }
                            />
                          ) : (
                            <div className="cover-placeholder">
                              📖
                            </div>
                          )}
                        </div>

                        <div className="novel-card-content">
                          <span className="novel-category">
                            {novel.categories
                              ?.name ||
                              "رواية"}
                          </span>

                          <h3>
                            {
                              novel.title
                            }
                          </h3>

                          <p>
                            {novel.description ||
                              "لا يوجد وصف حاليًا."}
                          </p>

                          <div className="novel-meta">
                            <span>
                              {novel.status ===
                              "completed"
                                ? "مكتملة"
                                : "مستمرة"}
                            </span>
                          </div>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>
          </section>
        )}
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
