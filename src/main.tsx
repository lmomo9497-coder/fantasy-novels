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

type StaffMember = {
  id: string;
  display_name: string | null;
  role: Role;
  email?: string | null;
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

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] = useState("");
  const [novelCategory, setNovelCategory] = useState("");
  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");
  const [novelLanguage, setNovelLanguage] = useState("العربية");
  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");

  const [novelMessage, setNovelMessage] = useState("");

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [managingStaff, setManagingStaff] = useState(false);

  const isOwner = profile?.role === "owner";
  const isStaff = profile?.role === "staff";
  const canManageNovels = isOwner || isStaff;

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
      .select("id,display_name,avatar_url,bio,role")
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
      .select(
        `
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
        categories(id,name,slug)
      `
      )
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (data) {
      setPublishedNovels(data as Novel[]);
    }
  }

  async function loadAdminData() {
    if (!canManageNovels) return;

    const { data } = await supabase
      .from("novels")
      .select(
        `
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
        categories(id,name,slug)
      `
      )
      .order("created_at", { ascending: false });

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
      const { data, error } = await supabase.functions.invoke(
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

      setFavorites(fav.data ?? []);
      setHistory(hist.data ?? []);
      setNotifications(notif.data ?? []);
    } finally {
      setLoadingAccountData(false);
    }
  }

  async function saveNovel(publish: boolean) {
    if (!user || !canManageNovels) {
      setNovelMessage("ليس لديك صلاحية لإضافة الروايات.");
      return;
    }

    if (!novelTitle.trim()) {
      setNovelMessage("اكتبي اسم الرواية أولًا.");
      return;
    }

    if (!novelCategory.trim()) {
      setNovelMessage("اكتبي تصنيف الرواية.");
      return;
    }

    setSavingNovel(true);
    setNovelMessage("");

    try {
      let categoryId: string | null = null;

      const existingCategory = categories.find(
        (category) =>
          category.name.trim().toLowerCase() ===
          novelCategory.trim().toLowerCase()
      );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const { data: newCategory, error: categoryError } =
          await supabase
            .from("categories")
            .insert({
              name: novelCategory.trim(),
              slug: makeSlug(novelCategory),
            })
            .select("id,name,slug")
            .single();

        if (categoryError) {
          setNovelMessage(
            categoryError.message ||
              "حدث خطأ أثناء إنشاء التصنيف."
          );
          return;
        }

        categoryId = newCategory.id;
        setCategories((current) => [
          ...current,
          newCategory as Category,
        ]);
      }

      const baseSlug = makeSlug(novelTitle) || `novel-${Date.now()}`;

      const { error } = await supabase.from("novels").insert({
        title: novelTitle.trim(),
        slug: `${baseSlug}-${Date.now()}`,
        description: novelDescription.trim() || null,
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

      setNovelTitle("");
      setNovelDescription("");
      setNovelCategory("");
      setNovelStatus("ongoing");
      setNovelLanguage("العربية");
      setNovelDirection("rtl");
      setShowNovelForm(false);

      setNovelMessage(
        publish
          ? "تم حفظ الرواية ونشرها بنجاح."
          : "تم حفظ الرواية كمسودة. لن تظهر للقراء."
      );

      await loadAdminData();
      await loadPublishedNovels();
    } finally {
      setSavingNovel(false);
    }
  }

  async function toggleNovelPublished(novel: Novel) {
    if (!canManageNovels) {
      setNovelMessage("ليس لديك صلاحية لتغيير حالة الرواية.");
      return;
    }

    const nextPublished = !novel.published;

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

    setNovels((current) =>
      current.map((item) =>
        item.id === novel.id
          ? { ...item, published: nextPublished }
          : item
      )
    );

    setPublishedNovels((current) => {
      if (nextPublished) {
        return current.some((item) => item.id === novel.id)
          ? current
          : [...current, { ...novel, published: true }];
      }

      return current.filter((item) => item.id !== novel.id);
    });

    setNovelMessage(
      nextPublished
        ? `تم نشر «${novel.title}».`
        : `تم إلغاء نشر «${novel.title}» وحفظها كمسودة.`
    );

    await loadPublishedNovels();
  }

  async function deleteNovel(novel: Novel) {
    if (!isOwner) {
      setNovelMessage("حذف الروايات متاح للمالك فقط.");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكدة من حذف رواية «${novel.title}»؟\n\nهذا الحذف للرواية نفسها.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("novels")
      .delete()
      .eq("id", novel.id);

    if (error) {
      setNovelMessage(error.message);
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

    setNovelMessage("تم حذف الرواية.");
  }

  async function addStaff() {
    if (!isOwner) return;

    if (!staffEmail.trim()) {
      setStaffMessage("اكتبي بريد المشرف.");
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
            email: staffEmail.trim(),
            role: "staff",
          },
        }
      );

      if (error) {
        setStaffMessage(error.message);
        return;
      }

      if (data?.error) {
        setStaffMessage(data.error);
        return;
      }

      setStaffEmail("");
      setStaffMessage("تمت إضافة المشرف بنجاح.");
      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function removeStaff(staff: StaffMember) {
    if (!isOwner) return;

    const confirmed = window.confirm(
      `هل تريدين إزالة صلاحية المشرف من ${
        staff.display_name || "هذا المستخدم"
      }؟`
    );

    if (!confirmed) return;

    setManagingStaff(true);

    try {
      const { data, error } = await supabase.functions.invoke(
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
        setStaffMessage(error.message);
        return;
      }

      if (data?.error) {
        setStaffMessage(data.error);
        return;
      }

      setStaffMessage("تمت إزالة صلاحية المشرف.");
      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setShowAccount(false);
    setShowAdmin(false);
    setSelectedNovel(null);
  }

  async function markNotificationRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  }

  function openNovel(novel: Novel) {
    setSelectedNovel(novel);
    setShowNovels(false);
  }

  function backToNovels() {
    setSelectedNovel(null);
    setShowNovels(true);
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read
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
              setShowNovels(true);
            }}
          >
            <strong>روايات خيالية</strong>
            <span>عالم من الحكايات</span>
          </button>

          <nav className="main-nav">
            <button
              className={showNovels ? "active" : ""}
              onClick={() => {
                setShowNovels(true);
                setShowAccount(false);
                setShowAdmin(false);
                setSelectedNovel(null);
              }}
            >
              الروايات
            </button>

            {user && (
              <button
                className={showAccount ? "active" : ""}
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                }}
              >
                حسابي
                {unreadNotifications > 0 && (
                  <span className="notification-badge">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            )}

            {canManageNovels && (
              <button
                className={showAdmin ? "active" : ""}
                onClick={() => {
                  setShowAdmin(true);
                  setShowAccount(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
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
                }}
              >
                {profile?.display_name ||
                  user.email ||
                  "حسابي"}
              </button>
            ) : (
              <button
                className="account-button"
                onClick={loginWithGoogle}
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
              onClick={backToNovels}
            >
              ← العودة للروايات
            </button>

            <div className="novel-detail">
              <div className="novel-cover-large">
                {selectedNovel.cover_path ? (
                  <img
                    src={selectedNovel.cover_path}
                    alt={selectedNovel.title}
                  />
                ) : (
                  <div className="cover-placeholder">
                    📖
                  </div>
                )}
              </div>

              <div className="novel-detail-content">
                <span className="novel-category">
                  {selectedNovel.categories?.name ||
                    "رواية"}
                </span>

                <h1>{selectedNovel.title}</h1>

                <p>
                  {selectedNovel.description ||
                    "لا يوجد وصف لهذه الرواية حاليًا."}
                </p>

                <div className="novel-meta">
                  <span>
                    {selectedNovel.status === "completed"
                      ? "مكتملة"
                      : "مستمرة"}
                  </span>
                  <span>{selectedNovel.language}</span>
                </div>

                <button className="primary-button">
                  بدء القراءة
                </button>
              </div>
            </div>
          </section>
        ) : showAdmin && canManageNovels ? (
          <section className="account-page">
            <div className="page-heading">
              <span>لوحة الإدارة</span>
              <h1>إدارة الروايات</h1>
              <p>
                هنا يمكنك حفظ الروايات كمسودات ثم نشرها
                عندما تصبح جاهزة.
              </p>
            </div>

            <div className="account-card">
              <div className="admin-heading
