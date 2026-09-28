import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";
import { AdsAdmin, ChapterExtras } from "./features/ChapterExtras";

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
  cover_position?: string | null;
  category_id: string | null;
  status: "ongoing" | "completed";
  language: string;
  direction: "rtl" | "ltr";
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
  latest_chapter_published_at?: string | null;
  categories?: Category | null;
  novel_categories?: { category: Category }[];
  reader_count?: number;
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
  align: string;
  width: number | null;
  height: number | null;
  object_position?: string | null;
  text_overlay_opacity?: number | null;
  text_image_scale_percent?: number | null;
  background_opacity?: number | null;
  text_position_x?: number | null;
  text_position_y?: number | null;
  effect_audio_path?: string | null;
  text_font_size?: number | null;
  text_color?: string | null;
  text_align?: "left" | "center" | "right" | null;
  text_width_percent?: number | null;
  text_height_percent?: number | null;
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

function getPublicPathForRoute(route: any) {
  if (route?.type === "novel" && route.novelSlug) {
    return `/novel/${encodeURIComponent(route.novelSlug)}`;
  }
  if (route?.type === "chapter" && route.novelSlug && route.chapterId) {
    return `/novel/${encodeURIComponent(route.novelSlug)}/chapter/${encodeURIComponent(route.chapterId)}`;
  }
  if (route?.type === "account") return "/account";
  if (route?.type === "admin") return "/admin";
  return "/";
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NEW_CHAPTER_WINDOW_MS = 36 * 60 * 60 * 1000;

function isChapterNew(chapter: Chapter, nowMs = Date.now()) {
  if (!chapter.published_at) return false;
  const publishedMs = new Date(chapter.published_at).getTime();
  if (!Number.isFinite(publishedMs)) return false;
  const age = nowMs - publishedMs;
  return age >= 0 && age < NEW_CHAPTER_WINDOW_MS;
}

function parseObjectPosition(value: string | null | undefined) {
  const match = String(value || "").match(
    /^(0|[1-9][0-9]?|100)% (0|[1-9][0-9]?|100)%$/
  );
  if (!match) return { x: 50, y: 50 };
  return { x: Number(match[1]), y: Number(match[2]) };
}

function renderProfessionalTextGlow(content: string | null | undefined) {
  return String(content || "")
    .split(/(\s+|[،؛,:.!؟…])/u)
    .map((part, index) => {
      if (!part) return null;

      if (/^\s+$/u.test(part)) {
        return <React.Fragment key={index}>{part}</React.Fragment>;
      }

      return (
        <span key={index} className="chapter-text-glow-token">
          {part}
        </span>
      );
    });
}

type CoverCropEditorProps = {
  src: string;
  positionX: number;
  positionY: number;
  onChangePosition: (x: number, y: number) => void;
};

function CoverCropEditor({
  src,
  positionX,
  positionY,
  onChangePosition,
}: CoverCropEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);
  const [localPosition, setLocalPosition] = useState({
    x: Math.min(100, Math.max(0, positionX)),
    y: Math.min(100, Math.max(0, positionY)),
  });

  useEffect(() => {
    setLocalPosition({
      x: Math.min(100, Math.max(0, positionX)),
      y: Math.min(100, Math.max(0, positionY)),
    });
  }, [positionX, positionY]);

  function updatePosition(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.round(
      Math.min(
        100,
        Math.max(0, ((clientX - rect.left) / Math.max(1, rect.width)) * 100)
      )
    );
    const y = Math.round(
      Math.min(
        100,
        Math.max(0, ((clientY - rect.top) / Math.max(1, rect.height)) * 100)
      )
    );

    setLocalPosition({ x, y });
    onChangePosition(x, y);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    updatePosition(event.clientX, event.clientY);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    event.preventDefault();
    updatePosition(event.clientX, event.clientY);
  }

  function finishPointer() {
    dragRef.current = false;
  }

  return (
    <div className="cover-crop-editor">
      <div className="editor-control-title">
        اختاري الجزء الذي يظهر على الغلاف بالسحب داخل الإطار.
      </div>

      <div
        ref={stageRef}
        className="cover-crop-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="cover-crop-image"
          style={{
            objectPosition:
              localPosition.x + "% " + localPosition.y + "%",
          }}
        />
        <div
          className="cover-crop-focus"
          style={{
            left: localPosition.x + "%",
            top: localPosition.y + "%",
          }}
        >
          <span />
        </div>
      </div>

      <small className="form-hint">
        الموضع الحالي: {localPosition.x}% أفقيًا · {localPosition.y}% عموديًا
      </small>
    </div>
  );
}

type ImageCropEditorProps = {
  src: string;
  width: number | null;
  height: number | null;
  objectPosition: string | null | undefined;
  onSaveSize: (width: number, height: number) => void | Promise<void>;
  onSavePosition: (x: number, y: number) => void | Promise<void>;
};

function ImageCropEditor({
  src,
  width,
  height,
  objectPosition,
  onSaveSize,
  onSavePosition,
}: ImageCropEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: "resize" | "move";
    corner?: "nw" | "ne" | "sw" | "se";
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startPositionX: number;
    startPositionY: number;
    scale: number;
    displayWidth: number;
    displayHeight: number;
  } | null>(null);

  const latestWidthRef = useRef(width ?? 360);
  const latestHeightRef = useRef(height ?? 220);
  const latestPositionRef = useRef(parseObjectPosition(objectPosition));

  const [localWidth, setLocalWidth] = useState(width ?? 360);
  const [localHeight, setLocalHeight] = useState(height ?? 220);
  const [localPosition, setLocalPosition] = useState(
    parseObjectPosition(objectPosition)
  );

  useEffect(() => {
    const nextWidth = width ?? 360;
    const nextHeight = height ?? 220;
    latestWidthRef.current = nextWidth;
    latestHeightRef.current = nextHeight;
    setLocalWidth(nextWidth);
    setLocalHeight(nextHeight);
  }, [width, height]);

  useEffect(() => {
    const nextPosition = parseObjectPosition(objectPosition);
    latestPositionRef.current = nextPosition;
    setLocalPosition(nextPosition);
  }, [objectPosition]);

  function getMetrics() {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        scale: 1,
        displayWidth: localWidth,
        displayHeight: localHeight,
      };
    }

    const scale = Math.max(
      0.1,
      Math.min(
        1,
        (rect.width - 24) / Math.max(1, localWidth),
        (rect.height - 24) / Math.max(1, localHeight)
      )
    );

    return {
      scale,
      displayWidth: localWidth * scale,
      displayHeight: localHeight * scale,
    };
  }

  function startDrag(
    event: React.PointerEvent<HTMLElement>,
    type: "resize" | "move",
    corner?: "nw" | "ne" | "sw" | "se"
  ) {
    event.preventDefault();
    event.stopPropagation();

    const metrics = getMetrics();
    dragRef.current = {
      type,
      corner,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: latestWidthRef.current,
      startHeight: latestHeightRef.current,
      startPositionX: latestPositionRef.current.x,
      startPositionY: latestPositionRef.current.y,
      scale: metrics.scale,
      displayWidth: metrics.displayWidth,
      displayHeight: metrics.displayHeight,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.type === "move") {
      const dxPercent =
        ((event.clientX - drag.startX) /
          Math.max(1, drag.displayWidth)) *
        100;
      const dyPercent =
        ((event.clientY - drag.startY) /
          Math.max(1, drag.displayHeight)) *
        100;

      const nextPosition = {
        x: Math.min(
          100,
          Math.max(0, Math.round(drag.startPositionX - dxPercent))
        ),
        y: Math.min(
          100,
          Math.max(0, Math.round(drag.startPositionY - dyPercent))
        ),
      };

      latestPositionRef.current = nextPosition;
      setLocalPosition(nextPosition);
      return;
    }

    const dx = (event.clientX - drag.startX) / drag.scale;
    const dy = (event.clientY - drag.startY) / drag.scale;

    let nextWidth = drag.startWidth;
    let nextHeight = drag.startHeight;

    if (drag.corner?.includes("e")) nextWidth += dx;
    if (drag.corner?.includes("w")) nextWidth -= dx;
    if (drag.corner?.includes("s")) nextHeight += dy;
    if (drag.corner?.includes("n")) nextHeight -= dy;

    const safeWidth = Math.min(2000, Math.max(80, Math.round(nextWidth)));
    const safeHeight = Math.min(2000, Math.max(80, Math.round(nextHeight)));

    latestWidthRef.current = safeWidth;
    latestHeightRef.current = safeHeight;
    setLocalWidth(safeWidth);
    setLocalHeight(safeHeight);
  }

  async function finishDrag() {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;

    if (drag.type === "move") {
      const position = latestPositionRef.current;
      await onSavePosition(position.x, position.y);
      return;
    }

    await onSaveSize(
      latestWidthRef.current,
      latestHeightRef.current
    );
  }

  const metrics = getMetrics();

  return (
    <div className="image-crop-controls">
      <span className="editor-control-title">
        كبّري أو صغّري الصورة بالسحب من الزوايا، واسحبي الصورة نفسها لاختيار المشهد.
      </span>

      <div
        ref={stageRef}
        className="image-crop-stage"
        onPointerMove={moveDrag}
        onPointerUp={() => void finishDrag()}
        onPointerCancel={() => void finishDrag()}
      >
        <div
          className="image-crop-frame"
          style={{
            width: metrics.displayWidth + "px",
            height: metrics.displayHeight + "px",
          }}
          onPointerDown={(event) => startDrag(event, "move")}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              objectFit: "cover",
              objectPosition:
                localPosition.x + "% " + localPosition.y + "%",
            }}
          />

          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label="تغيير حجم الصورة"
              className={"image-crop-handle image-crop-handle-" + corner}
              onPointerDown={(event) =>
                startDrag(event, "resize", corner)
              }
            />
          ))}
        </div>
      </div>

      <small className="form-hint">
        اسحبي الصورة داخل الإطار لتحريك المشهد. اسحبي أي زاوية لتمديدها طولًا أو عرضًا.
      </small>
    </div>
  );
}


type TextResizeEditorProps = {
  width: number | null;
  height: number | null;
  onSaveSize: (width: number, height: number) => void | Promise<void>;
};

function TextResizeEditor({
  width,
  height,
  onSaveSize,
}: TextResizeEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    scale: number;
    corner: "nw" | "ne" | "sw" | "se";
  } | null>(null);

  const latestWidthRef = useRef(width ?? 360);
  const latestHeightRef = useRef(height ?? 220);
  const [localWidth, setLocalWidth] = useState(width ?? 360);
  const [localHeight, setLocalHeight] = useState(height ?? 220);

  useEffect(() => {
    const nextWidth = width ?? 360;
    const nextHeight = height ?? 220;
    latestWidthRef.current = nextWidth;
    latestHeightRef.current = nextHeight;
    setLocalWidth(nextWidth);
    setLocalHeight(nextHeight);
  }, [width, height]);

  function getMetrics() {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        scale: 1,
        displayWidth: localWidth,
        displayHeight: localHeight,
      };
    }

    const scale = Math.max(
      0.1,
      Math.min(
        1,
        (rect.width - 24) / Math.max(1, localWidth),
        (rect.height - 24) / Math.max(1, localHeight)
      )
    );

    return {
      scale,
      displayWidth: localWidth * scale,
      displayHeight: localHeight * scale,
    };
  }

  function startResize(
    event: React.PointerEvent<HTMLButtonElement>,
    corner: "nw" | "ne" | "sw" | "se"
  ) {
    event.preventDefault();
    event.stopPropagation();

    const metrics = getMetrics();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: latestWidthRef.current,
      startHeight: latestHeightRef.current,
      scale: metrics.scale,
      corner,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveResize(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = (event.clientX - drag.startX) / drag.scale;
    const dy = (event.clientY - drag.startY) / drag.scale;

    let nextWidth = drag.startWidth;
    let nextHeight = drag.startHeight;

    if (drag.corner.includes("e")) nextWidth += dx;
    if (drag.corner.includes("w")) nextWidth -= dx;
    if (drag.corner.includes("s")) nextHeight += dy;
    if (drag.corner.includes("n")) nextHeight -= dy;

    const safeWidth = Math.min(2000, Math.max(120, Math.round(nextWidth)));
    const safeHeight = Math.min(2000, Math.max(60, Math.round(nextHeight)));

    latestWidthRef.current = safeWidth;
    latestHeightRef.current = safeHeight;
    setLocalWidth(safeWidth);
    setLocalHeight(safeHeight);
  }

  async function finishResize() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    await onSaveSize(
      latestWidthRef.current,
      latestHeightRef.current
    );
  }

  const metrics = getMetrics();

  return (
    <div className="image-crop-controls text-resize-controls">
      <span className="editor-control-title">
        كبّري أو صغّري مساحة النص بالسحب من الزوايا.
      </span>

      <div
        ref={stageRef}
        className="image-crop-stage text-resize-stage"
        onPointerMove={moveResize}
        onPointerUp={() => void finishResize()}
        onPointerCancel={() => void finishResize()}
      >
        <div
          className="image-crop-frame text-resize-frame"
          style={{
            width: metrics.displayWidth + "px",
            minHeight: metrics.displayHeight + "px",
          }}
        >
          <div className="text-resize-sample">معاينة مساحة النص</div>

          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label="تغيير حجم النص"
              className={"image-crop-handle image-crop-handle-" + corner}
              onPointerDown={(event) =>
                startResize(event, corner)
              }
            />
          ))}
        </div>
      </div>

      <small className="form-hint">
        لا تحتاجين كتابة بكسل؛ اسحبي الزوايا فقط.
      </small>
    </div>
  );
}



type StorageUploadBucket = "avatars" | "covers" | "chapter-media" | "audio";

const STORAGE_UPLOAD_RULES: Record<
  StorageUploadBucket,
  { maxBytes: number; mimeTypes: string[]; label: string }
> = {
  avatars: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "صورة الحساب",
  },
  covers: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    label: "غلاف الرواية",
  },
  "chapter-media": {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "صورة الفصل",
  },
  audio: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "audio/aac",
    ],
    label: "ملف صوتي",
  },
};

function validateStorageUpload(
  file: File,
  bucket: StorageUploadBucket
): string | null {
  const rule = STORAGE_UPLOAD_RULES[bucket];

  if (!rule.mimeTypes.includes(file.type)) {
    return `${rule.label}: نوع الملف غير مسموح.`;
  }

  if (file.size > rule.maxBytes) {
    return `${rule.label}: حجم الملف يتجاوز الحد المسموح.`;
  }

  return null;
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

type TextSceneEditorProps = {
  src: string;
  content: string;
  positionX: number;
  positionY: number;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
  widthPercent: number;
  heightPercent: number;
  onChangePosition: (x: number, y: number) => void;
  onChangeFontSize: (size: number) => void;
  onChangeColor: (color: string) => void;
  onChangeAlign: (align: "left" | "center" | "right") => void;
  onChangeWidth: (width: number) => void;
  onChangeHeight: (height: number) => void;
  effectAudioPath?: string | null;
  effectAudioPlaying?: boolean;
  onToggleEffectAudio?: () => void;
  imageScalePercent?: number;
  onChangeImageScale?: (value: number) => void;
};

function clampTextFontSize(value: number) {
  return Math.min(64, Math.max(12, Math.round(Number(value) || 18)));
}

function TextSceneEditor({
  src,
  content,
  positionX,
  positionY,
  fontSize,
  color,
  textAlign,
  widthPercent,
  heightPercent,
  onChangePosition,
  onChangeFontSize,
  onChangeColor,
  onChangeAlign,
  onChangeWidth,
  onChangeHeight,
  effectAudioPath,
  effectAudioPlaying = false,
  onToggleEffectAudio,
}: TextSceneEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [localPosition, setLocalPosition] = useState({
    x: positionX,
    y: positionY,
  });

  useEffect(() => {
    setLocalPosition({ x: positionX, y: positionY });
  }, [positionX, positionY]);

  function updateFromPointer(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x =
      ((clientX - rect.left) / Math.max(1, rect.width)) * 100 -
      (dragRef.current?.offsetX || 0);
    const y =
      ((clientY - rect.top) / Math.max(1, rect.height)) * 100 -
      (dragRef.current?.offsetY || 0);

    setLocalPosition({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = (localPosition.x / 100) * rect.width;
    const currentY = (localPosition.y / 100) * rect.height;

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX:
        ((event.clientX - rect.left - currentX) / Math.max(1, rect.width)) *
        100,
      offsetY:
        ((event.clientY - rect.top - currentY) / Math.max(1, rect.height)) *
        100,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      dragRef.current = null;
      return;
    }

    const nextX =
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100 -
      (dragRef.current.offsetX || 0);
    const nextY =
      ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100 -
      (dragRef.current.offsetY || 0);

    dragRef.current = null;

    const x = Math.min(100, Math.max(0, Math.round(nextX)));
    const y = Math.min(100, Math.max(0, Math.round(nextY)));

    setLocalPosition({ x, y });
    onChangePosition(x, y);
  }

  const safeWidth = Math.min(100, Math.max(60, Number(widthPercent) || 100));
  const safeHeight = Math.min(100, Math.max(30, Number(heightPercent) || 100));
  const safeSize = clampTextFontSize(fontSize);
  const safeX = Math.min(100, Math.max(0, localPosition.x));
  const safeY = Math.min(100, Math.max(0, localPosition.y));
  const transform =
    safeX >= 85
      ? "translate(-100%, -100%)"
      : safeX <= 15
        ? "translate(0, 0)"
        : safeY >= 85
          ? "translate(-50%, -100%)"
          : safeY <= 15
            ? "translate(-50%, 0)"
            : "translate(-50%, -50%)";

  return (
    <div className="text-scene-editor">
      <div ref={stageRef} className="text-scene-editor-stage" onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        <img
          src={src}
          alt=""
          className="text-scene-editor-image-natural"
          draggable={false}
        />
        <div className="text-scene-editor-dim" />

        <div
          className="text-scene-editor-text-window"
          style={{
            left: "clamp(10px, " + safeX + "%, calc(100% - 10px))",
            top: "clamp(10px, " + safeY + "%, calc(100% - 10px))",
            width: "min(" + safeWidth + "%, calc(100% - 20px))",
            height: "min(" + safeHeight + "%, calc(100% - 20px))",
            transform,
            color,
            fontSize: safeSize + "px",
            textAlign,
          }}
          onPointerDown={handlePointerDown}
        >
          <div className="chapter-text-glow-content">
            {renderProfessionalTextGlow(content)}
          </div>
        </div>

        <div
          className="chapter-text-editor-effect-audio"
          aria-hidden={!effectAudioPath || !onToggleEffectAudio}
        >
          {effectAudioPath && onToggleEffectAudio && (
            <button
              type="button"
              className={
                "chapter-effect-audio-button" +
                (effectAudioPlaying ? " is-playing" : "")
              }
              onClick={(event) => {
                event.stopPropagation();
                onToggleEffectAudio();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={
                effectAudioPlaying
                  ? "إيقاف المؤثر الصوتي"
                  : "تشغيل المؤثر الصوتي"
              }
            >
              🔊
            </button>
          )}
        </div>
      </div>

      <div className="text-scene-editor-controls">
        <div className="text-scene-controls-header">
          <div>
            <span className="text-scene-controls-kicker">TEXT STYLE</span>
            <strong>تنسيق النص</strong>
          </div>
          <span className="text-scene-controls-status">يظهر فوق الصورة بدون حجبها</span>
        </div>

        <div className="text-scene-controls-grid">
          <label className="text-scene-setting">
            <span>حجم الخط</span>
            <div className="text-scene-range-row">
              <input
                type="range"
                min="12"
                max="64"
                step="1"
                value={safeSize}
                onChange={(event) => onChangeFontSize(Number(event.target.value))}
              />
              <output>{safeSize}px</output>
            </div>
          </label>

          <label className="text-scene-setting">
            <span>عرض النص</span>
            <div className="text-scene-range-row">
              <input
                type="range"
                min="60"
                max="100"
                step="1"
                value={safeWidth}
                onChange={(event) => onChangeWidth(Number(event.target.value))}
              />
              <output>{safeWidth}%</output>
            </div>
          </label>

          <label className="text-scene-setting">
            <span>طول مساحة النص</span>
            <div className="text-scene-range-row">
              <input
                type="range"
                min="30"
                max="100"
                step="1"
                value={safeHeight}
                onChange={(event) => onChangeHeight(Number(event.target.value))}
              />
              <output>{safeHeight}%</output>
            </div>
          </label>

          <label className="text-scene-setting">
            <span>المحاذاة</span>
            <select
              value={textAlign}
              onChange={(event) =>
                onChangeAlign(
                  event.target.value as "left" | "center" | "right"
                )
              }
            >
              <option value="right">يمين</option>
              <option value="center">وسط</option>
              <option value="left">يسار</option>
            </select>
          </label>

          <label className="text-scene-setting text-scene-color-setting">
            <span>لون النص</span>
            <div className="text-scene-color-row">
              <input
                type="color"
                value={color}
                onChange={(event) => onChangeColor(event.target.value)}
              />
              <code>{color.toUpperCase()}</code>
            </div>
          </label>
        </div>

        <div className="text-scene-position-note">
          <span>↕</span>
          <div>
            <strong>موضع النص</strong>
            <small>اسحبي النص داخل الصورة فقط لتحديد مكانه.</small>
          </div>
        </div>

        <div className="text-scene-audio-card">
          <div>
            <span className="text-scene-controls-kicker">AUDIO</span>
            <strong>مؤثر صوتي</strong>
            <small>
              {effectAudioPath
                ? "يوجد مؤثر صوتي مرتبط بهذا النص."
                : "لا يوجد مؤثر صوتي لهذا النص."}
            </small>
          </div>
          {effectAudioPath && onToggleEffectAudio && (
            <button
              type="button"
              className={
                "text-scene-audio-action" +
                (effectAudioPlaying ? " is-playing" : "")
              }
              onClick={onToggleEffectAudio}
              aria-label={effectAudioPlaying ? "إيقاف المؤثر الصوتي" : "تشغيل المؤثر الصوتي"}
            >
              {effectAudioPlaying ? "إيقاف" : "تشغيل"} 🔊
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type TextSceneReaderProps = {
  src: string;
  content: string;
  positionX: number;
  positionY: number;
  color: string;
  textAlign: "left" | "center" | "right";
  widthPercent: number;
  heightPercent: number;
  effectAudioPath?: string | null;
  effectAudioPlaying?: boolean;
  onToggleEffectAudio?: () => void;
  readerFontSize: number;
  textVisible: boolean;
  imageVisible: boolean;
  imageDimLevel: number;
  textShadowLevel: number;
};

function TextSceneReader({
  src,
  content,
  positionX,
  positionY,
  color,
  textAlign,
  widthPercent,
  heightPercent,
  effectAudioPath,
  effectAudioPlaying = false,
  onToggleEffectAudio,
  readerFontSize,
  textVisible,
  imageVisible,
  imageDimLevel,
  textShadowLevel,
}: TextSceneReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollLastTimeRef = useRef<number | null>(null);
  const autoScrollDistanceRef = useRef(0);
  const [showHint, setShowHint] = useState(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(18);
  const [autoScrollMenuOpen, setAutoScrollMenuOpen] = useState(false);
  const autoScrollMenuRef = useRef<HTMLDivElement>(null);

  const autoScrollLevels = [
    { value: 4, label: "بطيء جدًا جدًا" },
    { value: 8, label: "بطيء جدًا" },
    { value: 14, label: "بطيء" },
    { value: 18, label: "عادي" },
    { value: 26, label: "سريع" },
    { value: 38, label: "سريع جدًا" },
  ];

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;

    setShowHint(element.scrollHeight > element.clientHeight + 4 && element.scrollTop < 8);
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        autoScrollMenuRef.current &&
        !autoScrollMenuRef.current.contains(target)
      ) {
        setAutoScrollMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAutoScrollMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(handleScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [readerFontSize, content, textVisible, imageVisible]);

  useEffect(() => {
    if (!textVisible && autoScrollEnabled) {
      setAutoScrollEnabled(false);
      return;
    }

    const element = scrollRef.current;

    if (!autoScrollEnabled || !element) return;

    let layoutRetryCount = 0;
    autoScrollLastTimeRef.current = null;
    autoScrollDistanceRef.current = 0;

    const stopAutoScroll = () => {
      setAutoScrollEnabled(false);
      autoScrollLastTimeRef.current = null;
      autoScrollDistanceRef.current = 0;
      autoScrollFrameRef.current = null;
    };

    const tick = (timestamp: number) => {
      const currentElement = scrollRef.current;
      if (!currentElement) return;

      const maxScroll = Math.max(
        0,
        currentElement.scrollHeight - currentElement.clientHeight
      );

      // Safari/iOS can report the final layout one or two frames after the
      // reader opens. Give it a few frames before deciding there is nothing
      // to scroll.
      if (maxScroll <= 0) {
        if (layoutRetryCount < 12) {
          layoutRetryCount += 1;
          autoScrollFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }
        stopAutoScroll();
        return;
      }

      layoutRetryCount = 0;

      if (currentElement.scrollTop >= maxScroll - 1) {
        stopAutoScroll();
        return;
      }

      const previous = autoScrollLastTimeRef.current ?? timestamp;
      const deltaMs = Math.min(50, Math.max(0, timestamp - previous));
      autoScrollLastTimeRef.current = timestamp;

      autoScrollDistanceRef.current += (autoScrollSpeed * deltaMs) / 1000;

      if (autoScrollDistanceRef.current >= 0.25) {
        const pixels = Math.min(
          autoScrollDistanceRef.current,
          maxScroll - currentElement.scrollTop
        );
        autoScrollDistanceRef.current -= pixels;

        currentElement.scrollTo({
          top: currentElement.scrollTop + pixels,
          behavior: "auto",
        });
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(() => {
      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    });

    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
      autoScrollFrameRef.current = null;
      autoScrollLastTimeRef.current = null;
      autoScrollDistanceRef.current = 0;
    };
  }, [autoScrollEnabled, autoScrollSpeed, content, readerFontSize, textVisible]);

  const numericWidth = Number(widthPercent);
  const numericX = Number(positionX);
  const numericY = Number(positionY);
  const safeWidth = Math.min(96, Math.max(78, Number.isFinite(numericWidth) ? numericWidth : 88));
  const safeX = Math.min(100, Math.max(0, Number.isFinite(numericX) ? numericX : 50));
  const safeY = Math.min(100, Math.max(0, Number.isFinite(numericY) ? numericY : 50));
  const safeReaderSize = clampTextFontSize(readerFontSize);
  const translateX = safeX >= 85 ? "-100%" : safeX <= 15 ? "0" : "-50%";
  const translateY = safeY >= 85 ? "-100%" : safeY <= 15 ? "0" : "-50%";
  const transform = "translate(" + translateX + ", " + translateY + ")";

  return (
    <div className="chapter-text-scene-reader">
      <div className="chapter-text-reader-toolbar">

          {effectAudioPath && onToggleEffectAudio && (
            <button
              type="button"
              className={
                "chapter-effect-audio-button" +
                (effectAudioPlaying ? " is-playing" : "")
              }
              onClick={onToggleEffectAudio}
              aria-label={
                effectAudioPlaying
                  ? "إيقاف المؤثر الصوتي"
                  : "تشغيل المؤثر الصوتي"
              }
              title={
                effectAudioPlaying
                  ? "إيقاف المؤثر الصوتي"
                  : "تشغيل المؤثر الصوتي"
              }
            >
              🔊
            </button>
          )}

          <button
            type="button"
            className={
              "chapter-text-autoscroll-button" +
              (autoScrollEnabled ? " is-enabled" : "")
            }
            onClick={() => setAutoScrollEnabled((current) => !current)}
            aria-pressed={autoScrollEnabled}
            title={
              autoScrollEnabled
                ? "إيقاف التمرير التلقائي"
                : "تشغيل التمرير التلقائي"
            }
          >
            {autoScrollEnabled ? "⏸ إيقاف" : "▶ تمرير تلقائي"}
          </button>

          <div
            ref={autoScrollMenuRef}
            className={
              "chapter-text-autoscroll-menu" +
              (autoScrollMenuOpen ? " is-open" : "")
            }
          >
            <button
              type="button"
              className="chapter-text-autoscroll-more"
              onClick={() => setAutoScrollMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={autoScrollMenuOpen}
              aria-label="مستويات سرعة التمرير"
              title="مستويات سرعة التمرير"
            >
              <span aria-hidden="true">⋮</span>
            </button>

            {autoScrollMenuOpen && (
              <div className="chapter-text-autoscroll-menu-panel" role="menu">
                <div className="chapter-text-autoscroll-menu-title">
                  سرعة التمرير
                </div>

                {autoScrollLevels.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={autoScrollSpeed === level.value}
                    className={
                      "chapter-text-autoscroll-option" +
                      (autoScrollSpeed === level.value ? " is-selected" : "")
                    }
                    onClick={() => {
                      setAutoScrollSpeed(level.value);
                      setAutoScrollMenuOpen(false);
                    }}
                  >
                    <span className="chapter-text-autoscroll-option-check">
                      {autoScrollSpeed === level.value ? "✓" : ""}
                    </span>
                    <span>{level.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      <div className="chapter-text-scene-reader-stage">
        <img
          src={src}
          alt=""
          className={
            "chapter-text-scene-reader-image" +
            (imageVisible ? "" : " is-hidden") +
            (imageDimLevel > 0 ? " is-dimmed-level-" + imageDimLevel : "")
          }
          draggable={false}
          aria-hidden={!imageVisible}
          onLoad={() => window.requestAnimationFrame(handleScroll)}
        />

        <div
          className="chapter-text-scene-reader-window"
          style={{
            left: "clamp(10px, " + safeX + "%, calc(100% - 10px))",
            top: "clamp(10px, " + safeY + "%, calc(100% - 10px))",
            width: "min(" + safeWidth + "%, calc(100% - 20px))",
            height: "min(" + Math.min(100, Math.max(30, Number(heightPercent) || 100)) + "%, 100%)",
            transform,
          }}
        >
          {textVisible && (
            <>
              <div
                ref={scrollRef}
                className={
                  "chapter-text-scene-reader-scroll" +
                  (textShadowLevel > 0
                    ? " is-shadow-level-" + textShadowLevel
                    : "")
                }
                onScroll={handleScroll}
                onTouchStart={() => setAutoScrollEnabled(false)}
                onWheel={() => setAutoScrollEnabled(false)}
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse") {
                    setAutoScrollEnabled(false);
                  }
                }}
                style={{
                  color,
                  fontSize: safeReaderSize + "px",
                  textAlign,
                }}
              >
                <div className="chapter-text-glow-content">
                  {renderProfessionalTextGlow(content)}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      {textVisible && showHint && (
        <div className="chapter-text-reader-hint">
          مرر للأسفل لقراءة المزيد ↓
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNovels, setShowNovels] = useState(true);

  const navigationReadyRef = useRef(false);
  const suppressNavigationPushRef = useRef(false);
  const currentRouteKeyRef = useRef("");
  const profileLoadedUserIdRef = useRef<string | null>(null);

  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [selectedNovelAdminView, setSelectedNovelAdminView] = useState(false);

  const [activeSection, setActiveSection] =
    useState<AccountSection>("profile");

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(new Set());
  const [loadingAccountData, setLoadingAccountData] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminNovelSearch, setAdminNovelSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [readerProgress, setReaderProgress] = useState(0);
  const [readerFontSize, setReaderFontSize] = useState(18);
  const [chapterTextVisible, setChapterTextVisible] = useState(true);
  const [chapterImagesVisible, setChapterImagesVisible] = useState(true);
  const [chapterImageDimLevel, setChapterImageDimLevel] = useState(0);
  const [chapterTextShadowLevel, setChapterTextShadowLevel] = useState(0);

  const [showNovelForm, setShowNovelForm] = useState(false);
  const [savingNovel, setSavingNovel] = useState(false);
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null);

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] = useState("");
  const [novelCategories, setNovelCategories] = useState<string[]>([]);
  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");
  const [novelLanguage, setNovelLanguage] = useState("العربية");
  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");
  const [novelCoverPath, setNovelCoverPath] = useState("");
  const [novelCoverPosition, setNovelCoverPosition] = useState("50% 50%");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [novelMessage, setNovelMessage] = useState("");
  const [showFullCover, setShowFullCover] = useState(false);

  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [availableStaffUsers, setAvailableStaffUsers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState("");
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
  const activeEffectAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedReaderProgressRef = useRef<string>("");
  const chapterBlockPatchTimersRef = useRef<
    Map<string, ReturnType<typeof window.setTimeout>>
  >(new Map());
  const chapterBlockPendingPatchesRef = useRef<
    Map<string, Record<string, unknown>>
  >(new Map());
  const [activeEffectBlockId, setActiveEffectBlockId] = useState<string | null>(null);

  const [newBlockType, setNewBlockType] =
    useState<ChapterBlockType>("text");
  const [newBlockContent, setNewBlockContent] = useState("");
  const [newBlockMediaPath, setNewBlockMediaPath] = useState("");
  const [newBlockMediaLabel, setNewBlockMediaLabel] = useState("");
  const [newBlockAudioType, setNewBlockAudioType] =
    useState<"reader" | "effects">("reader");
  const [newBlockMediaPreviewUrl, setNewBlockMediaPreviewUrl] = useState("");
  const [newBlockLocalPreviewUrl, setNewBlockLocalPreviewUrl] = useState("");
  const [newBlockMediaFile, setNewBlockMediaFile] = useState<File | null>(null);
  const [newBlockEffectAudioFile, setNewBlockEffectAudioFile] = useState<File | null>(null);
  const [newBlockColumn, setNewBlockColumn] =
    useState<"left" | "right" | "full">("right");
  const [newBlockRow, setNewBlockRow] = useState("1");
  const [newBlockTextPosition, setNewBlockTextPosition] = useState("100");
  const [newTextPositionY, setNewTextPositionY] = useState(50);
  const [newTextFontSize, setNewTextFontSize] = useState(18);
  const [newTextColor, setNewTextColor] = useState("#ffffff");
  const [newTextAlign, setNewTextAlign] =
    useState<"left" | "center" | "right">("right");
  const [newTextWidthPercent, setNewTextWidthPercent] = useState(72);
  const [newBlockWidth, setNewBlockWidth] = useState("");
  const [newBlockHeight, setNewBlockHeight] = useState("");
  const [uploadingBlockMedia, setUploadingBlockMedia] = useState(false);
  const [uploadingEffectAudioId, setUploadingEffectAudioId] = useState<string | null>(null);

  const [authMode, setAuthMode] =
    useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [siteMessage, setSiteMessage] = useState("");
  const [loginToast, setLoginToast] = useState("");
  const [logoutToast, setLogoutToast] = useState("");

  const isOwner = profile?.role === "owner";
  const isStaff = profile?.role === "staff";
  const canManage = isOwner || isStaff;

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const currentRoute = useMemo(() => {
    if (selectedChapter && selectedNovel) {
      return {
        type: "chapter",
        novelId: selectedNovel.id,
        novelSlug: selectedNovel.slug || makeSlug(selectedNovel.title),
        chapterId: selectedChapter.id,
        adminView: selectedNovelAdminView,
        chapter: selectedChapter,
      };
    }

    if (selectedNovel) {
      return {
        type: "novel",
        novelId: selectedNovel.id,
        novelSlug: selectedNovel.slug || makeSlug(selectedNovel.title),
        adminView: selectedNovelAdminView,
      };
    }

    if (showAdmin && canManage) {
      return { type: "admin" };
    }

    if (showAccount) {
      return {
        type: "account",
        section: activeSection,
      };
    }

    return { type: "home" };
  }, [
    activeSection,
    canManage,
    selectedChapter,
    selectedNovel,
    selectedNovelAdminView,
    showAccount,
    showAdmin,
  ]);

  const currentRouteKey = JSON.stringify(currentRoute);

  const filteredNovels = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return publishedNovels.filter((novel) => {
      const title = normalizeSearchText(novel.title);
      const description = normalizeSearchText(novel.description || "");
      const matchesQuery =
        !query ||
        title.includes(query) ||
        description.includes(query);
      const novelCategoryIds = [
        ...(novel.category_id ? [novel.category_id] : []),
        ...(novel.novel_categories?.map((item) => item.category.id) ?? []),
      ];
      const matchesCategory =
        selectedCategoryFilter.length === 0 ||
        selectedCategoryFilter.some((id) => novelCategoryIds.includes(id));
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

  const filteredAdminNovels = useMemo(() => {
    const query = normalizeSearchText(adminNovelSearch);
    if (!query) return novels;
    return novels.filter((novel) => {
      const title = normalizeSearchText(novel.title);
      const description = normalizeSearchText(novel.description || "");
      return title.includes(query) || description.includes(query);
    });
  }, [novels, adminNovelSearch]);

  const newReleaseNovels = useMemo(() => {
    return publishedNovels
      .map((novel) => {
        const novelAt = novel.published_at
          ? new Date(novel.published_at).getTime()
          : 0;
        const chapterAt = novel.latest_chapter_published_at
          ? new Date(novel.latest_chapter_published_at).getTime()
          : 0;
        const latestAt = Math.max(
          Number.isFinite(novelAt) ? novelAt : 0,
          Number.isFinite(chapterAt) ? chapterAt : 0
        );

        return {
          novel,
          latestAt,
          activityLabel:
            novelAt >= chapterAt && novelAt > 0
              ? "رواية جديدة"
              : chapterAt > 0
                ? "فصل جديد"
                : "جديدة",
        };
      })
      .sort((a, b) => b.latestAt - a.latestAt)
      .slice(0, 6);
  }, [publishedNovels]);

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

  const readerBlocks = useMemo(
    () => [...chapterBlocks].sort((a, b) => a.block_order - b.block_order),
    [chapterBlocks]
  );

  useEffect(() => {
    activeEffectAudioRef.current?.pause();
    activeEffectAudioRef.current = null;
    setActiveEffectBlockId(null);

    return () => {
      activeEffectAudioRef.current?.pause();
      activeEffectAudioRef.current = null;
    };
  }, [selectedChapter?.id]);

  useEffect(() => {
    if (!selectedChapter) {
      setReaderFontSize(18);
      return;
    }

    const firstTextBlock = readerBlocks.find(
      (block) => block.block_type === "text"
    );

    setReaderFontSize(
      clampTextFontSize(Number(firstTextBlock?.text_font_size ?? 18))
    );
  }, [selectedChapter?.id, readerBlocks]);

  useEffect(() => {
    const publicPath = getPublicPathForRoute(currentRoute);

    if (!navigationReadyRef.current) {
      const initialPath = window.location.pathname;
      const isNovelDeepLink = initialPath.startsWith("/novel/");

      if (!isNovelDeepLink) {
        window.history.replaceState(
          { fantasyNovelsRoute: currentRoute },
          "",
          publicPath
        );
      }

      navigationReadyRef.current = true;
      currentRouteKeyRef.current = currentRouteKey;
      return;
    }

    if (suppressNavigationPushRef.current) {
      suppressNavigationPushRef.current = false;
      currentRouteKeyRef.current = currentRouteKey;
      return;
    }

    if (currentRouteKeyRef.current === currentRouteKey) return;

    window.history.pushState(
      { fantasyNovelsRoute: currentRoute },
      "",
      publicPath
    );
    currentRouteKeyRef.current = currentRouteKey;
  }, [currentRouteKey]);

  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    if (deepLinkHandledRef.current || publishedNovels.length === 0) return;

    const parts = window.location.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    if (parts[0] !== "novel" || !parts[1]) {
      deepLinkHandledRef.current = true;
      return;
    }

    const novel = publishedNovels.find(
      (item) => (item.slug || makeSlug(item.title)) === parts[1]
    );

    if (!novel) {
      deepLinkHandledRef.current = true;
      window.history.replaceState({ fantasyNovelsRoute: { type: "home" } }, "", "/");
      return;
    }

    deepLinkHandledRef.current = true;
    setSelectedNovel(novel);
    setSelectedNovelAdminView(false);
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(false);

    if (parts[2] === "chapter" && parts[3]) {
      void (async () => {
        const { data: chapter } = await supabase
          .from("chapters")
          .select("*")
          .eq("id", parts[3])
          .eq("novel_id", novel.id)
          .eq("published", true)
          .maybeSingle();

        if (!chapter) {
          window.history.replaceState(
            { fantasyNovelsRoute: { type: "novel", novelId: novel.id, novelSlug: novel.slug || makeSlug(novel.title) } },
            "",
            `/novel/${encodeURIComponent(novel.slug || makeSlug(novel.title))}`
          );
          setSelectedChapter(null);
          return;
        }

        setSelectedChapter(chapter as Chapter);
        setLoadingChapterBlocks(true);
        const { data: blocks } = await supabase
          .from("chapter_blocks")
          .select("*")
          .eq("chapter_id", chapter.id)
          .order("block_order", { ascending: true });
        setChapterBlocks((blocks ?? []) as ChapterBlock[]);
        setLoadingChapterBlocks(false);
      })();
    }
  }, [publishedNovels]);

  useEffect(() => {
    const restoreRoute = async (route: any) => {
      suppressNavigationPushRef.current = true;
      currentRouteKeyRef.current = JSON.stringify(route);

      if (route?.type === "home") {
        setSelectedChapter(null);
        setSelectedNovel(null);
        setSelectedNovelAdminView(false);
        setShowAccount(false);
        setShowAdmin(false);
        setShowNovels(true);
        return;
      }

      if (route?.type === "account") {
        setActiveSection(route.section || "profile");
        setShowAccount(true);
        setShowAdmin(false);
        setShowNovels(false);
        setSelectedNovel(null);
        setSelectedChapter(null);
        setSelectedNovelAdminView(false);
        return;
      }

      if (route?.type === "admin") {
        if (!canManage) {
          setSelectedChapter(null);
          setSelectedNovel(null);
          setSelectedNovelAdminView(false);
          setShowAccount(false);
          setShowAdmin(false);
          setShowNovels(true);
          return;
        }

        setSelectedChapter(null);
        setSelectedNovel(null);
        setSelectedNovelAdminView(false);
        setShowAccount(false);
        setShowAdmin(true);
        setShowNovels(false);
        return;
      }

      if (route?.type === "novel" || route?.type === "chapter") {
        const source = [...publishedNovels, ...novels];
        const novel = source.find((item) => item.id === route.novelId);

        if (!novel) {
          setSelectedChapter(null);
          setSelectedNovel(null);
          setSelectedNovelAdminView(false);
          setShowAccount(false);
          setShowAdmin(false);
          setShowNovels(true);
          return;
        }

        setSelectedNovel(novel);
        setSelectedNovelAdminView(Boolean(route.adminView));
        setShowAccount(false);
        setShowAdmin(false);
        setShowNovels(false);

        if (route.type === "chapter" && route.chapter) {
          setChapterTextVisible(true);
          setChapterImagesVisible(true);
          setChapterImageDimLevel(0);
          setChapterTextShadowLevel(0);
          setSelectedChapter(route.chapter as Chapter);
          setChapterMessage("");
          setLoadingChapterBlocks(true);

          const { data, error } = await supabase
            .from("chapter_blocks")
            .select("*")
            .eq("chapter_id", route.chapter.id)
            .order("block_order", { ascending: true });

          if (!error) {
            setChapterBlocks((data ?? []) as ChapterBlock[]);
          } else {
            setChapterBlocks([]);
            setChapterMessage(error.message);
          }

          setLoadingChapterBlocks(false);
          return;
        }

        setSelectedChapter(null);
        setChapterBlocks([]);
        return;
      }

      setSelectedChapter(null);
      setSelectedNovel(null);
      setSelectedNovelAdminView(false);
      setShowAccount(false);
      setShowAdmin(false);
      setShowNovels(true);
    };

    const handlePopState = (event: PopStateEvent) => {
      const route = event.state?.fantasyNovelsRoute;
      if (!route) return;
      void restoreRoute(route);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [canManage, novels, publishedNovels]);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      // Token refresh is handled internally by Supabase. It does not
      // represent a profile/account change, so avoid reloading app data.
      if (_event === "TOKEN_REFRESHED") {
        return;
      }

      setUser(session?.user ?? null);

      if (_event === "SIGNED_IN" && session?.user) {
        setLoginToast("تم تسجيل الدخول بنجاح.");
        window.setTimeout(() => setLoginToast(""), 3500);
      }

      if (session?.user) {
        const shouldLoadProfile =
          _event === "INITIAL_SESSION" ||
          _event === "USER_UPDATED" ||
          (_event === "SIGNED_IN" &&
            profileLoadedUserIdRef.current !== session.user.id) ||
          (_event === "PASSWORD_RECOVERY" &&
            profileLoadedUserIdRef.current !== session.user.id);

        if (shouldLoadProfile) {
          profileLoadedUserIdRef.current = session.user.id;
          void loadProfile(session.user.id);
        }
      } else {
        profileLoadedUserIdRef.current = null;
        setProfile(null);
        setFavorites([]);
        setHistory([]);
        setNotifications([]);
        setReadChapterIds(new Set());
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
    if (user) {
      loadOwnerProfile();
    }
  }, [user?.id]);

  useEffect(() => {
    if (canManage) {
      loadAdminData();
      loadStaffMembers();
      if (isOwner) loadAvailableStaffUsers();
    }
  }, [canManage]);

  useEffect(() => {
    if (user) {
      loadAccountData();
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const timer = window.setInterval(() => {
      void loadNotificationsOnly();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [user?.id]);

  async function loadOwnerProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Owner profile error:", error);
      return;
    }

    setOwnerProfile(data as Profile | null);
  }

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

  async function attachNovelReaderCounts(novelsList: Novel[]) {
    if (novelsList.length === 0) return novelsList;

    const { data, error } = await supabase
      .from("novel_reader_counts")
      .select("novel_id, reader_count")
      .in(
        "novel_id",
        novelsList.map((novel) => novel.id)
      );

    if (error) {
      console.error("Novel reader counts error:", error);
      return novelsList.map((novel) => ({
        ...novel,
        reader_count: 0,
      }));
    }

    const counts = new Map(
      (data ?? []).map((item) => [
        item.novel_id,
        Number(item.reader_count || 0),
      ])
    );

    return novelsList.map((novel) => ({
      ...novel,
      reader_count: counts.get(novel.id) ?? 0,
    }));
  }

  async function loadPublishedNovels() {
    const { data, error } = await supabase
      .from("novels")
      .select("*, categories!novels_category_id_fkey(*), novel_categories(category:categories(*))")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Published novels error:", error);
      return;
    }

    const publishedNovelRows = (data ?? []) as Novel[];
    const novelIds = publishedNovelRows.map((novel) => novel.id);
    const latestChapterByNovel = new Map<string, string | null>();

    if (novelIds.length > 0) {
      const { data: chapterData, error: chapterError } = await supabase
        .from("chapters")
        .select("novel_id, published_at")
        .in("novel_id", novelIds)
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (!chapterError) {
        (chapterData ?? []).forEach((chapter) => {
          if (!latestChapterByNovel.has(chapter.novel_id)) {
            latestChapterByNovel.set(
              chapter.novel_id,
              chapter.published_at || null
            );
          }
        });
      }
    }

    const novelsWithActivity = publishedNovelRows.map((novel) => ({
      ...novel,
      latest_chapter_published_at:
        latestChapterByNovel.get(novel.id) ?? null,
    }));

    const novelsWithReaderCounts = await attachNovelReaderCounts(
      novelsWithActivity
    );
    setPublishedNovels(novelsWithReaderCounts);
  }

  async function loadAdminData() {
    const { data, error } = await supabase
      .from("novels")
      .select("*, categories!novels_category_id_fkey(*), novel_categories(category:categories(*))")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin novels error:", error);
      return;
    }

    const novelsWithReaderCounts = await attachNovelReaderCounts(
      (data ?? []) as Novel[]
    );
    setNovels(novelsWithReaderCounts);
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

  async function loadNotificationsOnly() {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .is("ignored_at", null)
      .order("created_at", { ascending: false });

    if (!error) {
      setNotifications(data ?? []);
    }
  }

  async function loadAccountData() {
    if (!user) return;

    setLoadingAccountData(true);

    try {
      const [favoritesResult, historyResult, notificationsResult, readsResult] =
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
            .is("ignored_at", null)
            .order("created_at", { ascending: false }),

          supabase
            .from("chapter_reads")
            .select("chapter_id")
            .eq("user_id", user.id),
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

      if (!readsResult.error) {
        setReadChapterIds(
          new Set(
            (readsResult.data ?? [])
              .map((item) => String(item.chapter_id))
              .filter(Boolean)
          )
        );
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

  async function dismissAllNotifications() {
    if (!user || notifications.length === 0) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({
        ignored_at: now,
        read_at: now,
      })
      .eq("user_id", user.id)
      .is("ignored_at", null);

    if (error) {
      setSiteMessage(error.message);
      return;
    }

    setNotifications([]);
  }

  async function markChapterRead(chapterId: string) {
    if (!user) return;

    const now = new Date().toISOString();

    setReadChapterIds((current) => {
      const next = new Set(current);
      next.add(chapterId);
      return next;
    });

    const { error } = await supabase
      .from("chapter_reads")
      .upsert(
        {
          user_id: user.id,
          chapter_id: chapterId,
          read_at: now,
        },
        { onConflict: "user_id,chapter_id" }
      );

    if (error) {
      console.error("Chapter read tracking error:", error);
    }
  }

  async function uploadProfileAvatar(file: File) {
    if (!user) return;

    const validationError = validateStorageUpload(file, "avatars");
    if (validationError) {
      setSiteMessage(validationError);
      return;
    }

    setSiteMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${makeStorageId()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setSiteMessage(uploadError.message);
        return;
      }

      const avatarUrl = getPublicMediaUrl("avatars", path);
      const { data, error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id)
        .select("*")
        .single();

      if (profileError) {
        setSiteMessage(profileError.message);
        return;
      }

      setProfile(data as Profile);
      setSiteMessage("تم تحديث صورة الحساب.");
    } catch (error: any) {
      setSiteMessage(error?.message || "تعذر رفع صورة الحساب.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setShowFullCover(false);
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(true);
    setShowSideMenu(false);
    setLogoutToast("تم تسجيل الخروج بنجاح.");
    window.setTimeout(() => setLogoutToast(""), 3500);
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
          setLoginToast("تم تسجيل الدخول بنجاح.");
          window.setTimeout(() => setLoginToast(""), 3500);
          setAuthEmail("");
          setAuthPassword("");
          setShowAccount(false);
          setShowAdmin(false);
          setShowNovels(true);
        }
      } else {
        if (authPassword.length < 12) {
          setAuthMessage("كلمة المرور يجب أن تكون 12 حرفًا أو أكثر.");
          return;
        }

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
    const validationError = validateStorageUpload(file, "covers");
    if (validationError) {
      setNovelMessage(validationError);
      return;
    }

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
      setNovelCoverPosition("50% 50%");
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
    setNovelCategories([]);
    setNovelStatus("ongoing");
    setNovelLanguage("العربية");
    setNovelDirection("rtl");
    setNovelCoverPath("");
    setNovelCoverPosition("50% 50%");
    setNovelMessage("");
  }

  function editNovel(novel: Novel) {
    setEditingNovelId(novel.id);
    setNovelTitle(novel.title);
    setNovelDescription(novel.description || "");
    setNovelCategories([...new Set([
      ...(novel.category_id ? [novel.category_id] : []),
      ...(novel.novel_categories?.map((item) => item.category.id) ?? []),
    ])]);
    setNovelStatus(novel.status);
    setNovelLanguage(novel.language || "العربية");
    setNovelDirection(novel.direction || "rtl");
    setNovelCoverPath(novel.cover_path || "");
    setNovelCoverPosition(novel.cover_position || "50% 50%");
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

      const existingNovel = editingNovelId
        ? novels.find((item) => item.id === editingNovelId)
        : null;

      const payload = {
        title: novelTitle.trim(),
        slug,
        description: novelDescription.trim() || null,
        cover_path: novelCoverPath || null,
        cover_position: novelCoverPosition || "50% 50%",
        category_id: novelCategories[0] || null,
        status: novelStatus,
        language: novelLanguage.trim() || "العربية",
        direction: novelDirection,
        published: publish,
        published_at: publish
          ? existingNovel?.published && existingNovel.published_at
            ? existingNovel.published_at
            : new Date().toISOString()
          : null,
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
            cover_position: payload.cover_position,
            category_id: payload.category_id,
            status: payload.status,
            language: payload.language,
            direction: payload.direction,
            published: payload.published,
            published_at: payload.published_at,
          })
          .eq("id", editingNovelId)
          .select("*, categories!novels_category_id_fkey(*), novel_categories(category:categories(*))")
          .single();

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        const { error: categoryDeleteError } = await supabase
          .from("novel_categories")
          .delete()
          .eq("novel_id", editingNovelId);

        if (categoryDeleteError) {
          setNovelMessage(categoryDeleteError.message);
          return;
        }

        if (novelCategories.length > 0) {
          const { error: categoryInsertError } = await supabase
            .from("novel_categories")
            .insert(novelCategories.map((categoryId) => ({
              novel_id: editingNovelId,
              category_id: categoryId,
            })));

          if (categoryInsertError) {
            setNovelMessage(categoryInsertError.message);
            return;
          }
        }

        const refreshed = {
          ...(data as Novel),
          novel_categories: novelCategories
            .map((categoryId) => categories.find((item) => item.id === categoryId))
            .filter(Boolean)
            .map((category) => ({ category: category as Category })),
        };

        setNovels((current) =>
          current.map((item) =>
            item.id === editingNovelId ? refreshed : item
          )
        );

        setPublishedNovels((current) => {
          if (!refreshed.published) {
            return current.filter((item) => item.id !== editingNovelId);
          }

          const exists = current.some((item) => item.id === editingNovelId);

          if (exists) {
            return current.map((item) =>
              item.id === editingNovelId ? refreshed : item
            );
          }

          return [refreshed, ...current];
        });

        setSelectedNovel((current) =>
          current?.id === editingNovelId ? refreshed : current
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
          .select("*, categories!novels_category_id_fkey(*), novel_categories(category:categories(*))")
          .single();

        if (error) {
          setNovelMessage(error.message);
          return;
        }

        if (novelCategories.length > 0) {
          const { error: categoryInsertError } = await supabase
            .from("novel_categories")
            .insert(novelCategories.map((categoryId) => ({
              novel_id: data.id,
              category_id: categoryId,
            })));

          if (categoryInsertError) {
            setNovelMessage(categoryInsertError.message);
            return;
          }
        }

        const refreshed = {
          ...(data as Novel),
          novel_categories: novelCategories
            .map((categoryId) => categories.find((item) => item.id === categoryId))
            .filter(Boolean)
            .map((category) => ({ category: category as Category })),
        };

        setNovels((current) => [refreshed, ...current]);

        if (data.published) {
          setPublishedNovels((current) => [refreshed, ...current]);
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
        published_at: nextPublished
          ? novel.published_at || new Date().toISOString()
          : null,
      })
      .eq("id", novel.id)
      .select("*, categories!novels_category_id_fkey(*), novel_categories(category:categories(*))")
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

    setConfirmDialog({
      message: `هل أنت متأكدة من حذف رواية "${novel.title}"؟`,
      onConfirm: async () => {

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
      },
    });
  }

  async function openNovel(
    novel: Novel,
    adminView: boolean = false
  ) {
    setSelectedNovel(novel);
    setSelectedNovelAdminView(adminView);
    setShowFullCover(false);
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
    setShowChapterForm(false);
    setSelectedNovelAdminView(true);
    void openChapter(chapter, true);
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
        const existingChapter = chapters.find(
          (item) => item.id === editingChapterId
        );

        const { data, error } = await supabase
          .from("chapters")
          .update({
            chapter_number: number,
            title: chapterTitle.trim() || null,
            published: publish,
            published_at: publish
              ? existingChapter?.published && existingChapter.published_at
                ? existingChapter.published_at
                : new Date().toISOString()
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

    setConfirmDialog({
      message: `هل أنتِ متأكدة من حذف الفصل ${chapter.chapter_number}؟`,
      onConfirm: async () => {

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
      },
    });
  }

  async function openChapter(
    chapter: Chapter,
    adminViewOverride?: boolean
  ) {
    if (!selectedNovel) return;

    const isAdminView = adminViewOverride ?? selectedNovelAdminView;

    setSelectedChapter(chapter);
    setReaderProgress(0);
    setReaderFontSize(18);
    setChapterTextVisible(true);
    setChapterImagesVisible(true);
    setChapterImageDimLevel(0);
    setChapterTextShadowLevel(0);
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

      const loadedBlocks = (data ?? []) as ChapterBlock[];
      setChapterBlocks(loadedBlocks);

      const firstTextBlock = loadedBlocks.find(
        (item) => item.block_type === "text"
      );
      if (firstTextBlock?.text_font_size) {
        setReaderFontSize(clampTextFontSize(firstTextBlock.text_font_size));
      }

      let savedProgress = 0;
      if (!isAdminView && user) {
        void markChapterRead(chapter.id);

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
        lastSavedReaderProgressRef.current =
          selectedNovel.id + ":" + chapter.id + ":" + savedProgress;
        await saveReadingProgress(selectedNovel.id, chapter.id, savedProgress);
      }

      if (!isAdminView) {
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

    await supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: user.id,
          novel_id: novelId,
          chapter_id: chapterId,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,novel_id" }
      );

    // تحديث السجل المحلي بدل إعادة تحميل بيانات الحساب كاملة بعد كل حفظ.
    setHistory((current) => {
      const next = current.filter((item) => item.novel_id !== novelId);
      return [
        {
          user_id: user.id,
          novel_id: novelId,
          chapter_id: chapterId,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        },
        ...next,
      ];
    });
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

    const progressKey = selectedNovel.id + ":" + selectedChapter.id;
    if (lastSavedReaderProgressRef.current === progressKey + ":" + percent) {
      return;
    }

    lastSavedReaderProgressRef.current = progressKey + ":" + percent;

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
      }, 3000);
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
    setNewBlockAudioType("reader");
    setNewBlockMediaPreviewUrl("");
    setNewBlockLocalPreviewUrl("");
    setNewBlockMediaFile(null);
    setNewBlockEffectAudioFile(null);
    setNewBlockColumn("right");
    setNewBlockRow("1");
    setNewBlockTextPosition("100");
    setNewTextPositionY(50);
    setNewTextFontSize(18);
    setNewTextColor("#ffffff");
    setNewTextAlign("right");
    setNewTextWidthPercent(72);
    setNewBlockWidth("");
    setNewBlockHeight("");
  }

  async function uploadChapterMedia(file: File) {
    if (!selectedChapter) return "";

    setUploadingBlockMedia(true);
    setChapterMessage("");

    try {
      const bucket =
        newBlockType === "audio" ? "audio" : "chapter-media";
      const validationError = validateStorageUpload(file, bucket);
      if (validationError) {
        setChapterMessage(validationError);
        return "";
      }

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${newBlockType === "text" ? "text-background" : newBlockType}/${makeStorageId()}.${extension}`;
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
        ["image", "gif", "audio", "text"].includes(newBlockType) &&
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

      let safeColumn = newBlockColumn;
      let safeRow = Math.max(1, Number(newBlockRow) || 1);

      // Prevent a full-width block from being hidden underneath
      // a side-column block (or vice versa) when both use the same row.
      while (
        chapterBlocks.some((block) => {
          const placement = parseBlockPlacement(block);
          const sameRow = placement.row === safeRow;
          if (!sameRow) return false;

          if (safeColumn === "full") {
            return true;
          }

          return (
            placement.column === "full" ||
            placement.column === safeColumn
          );
        })
      ) {
        safeRow += 1;
      }

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
            newBlockType === "audio"
              ? [
                  newBlockAudioType === "reader"
                    ? "القارئ"
                    : "مؤثرات صوتية",
                  newBlockMediaLabel.trim(),
                ]
                  .filter(Boolean)
                  .join(" — ") || null
              : newBlockMediaLabel.trim() || null,
          align: makeBlockAlign(
            safeColumn,
            safeRow,
            newBlockType === "text"
              ? Number(newBlockTextPosition)
              : undefined
          ),
          width: newBlockWidth
            ? Number(newBlockWidth)
            : null,
          height: newBlockHeight
            ? Number(newBlockHeight)
            : null,
          object_position: "50% 50%",
          text_position_x:
            newBlockType === "text"
              ? Number(newBlockTextPosition)
              : 50,
          text_position_y: 50,
          text_font_size: 18,
          text_color: "#ffffff",
          text_align: "right",
          text_width_percent: 100,
          text_height_percent: 100,
          text_overlay_opacity:
            newBlockType === "text" ? 0.24 : 0.62,
        })
        .select("*")
        .single();

      if (error) {
        setChapterMessage(error.message);
        return;
      }

      let savedBlock = data as ChapterBlock;

      if (newBlockType === "text" && newBlockEffectAudioFile) {
        const effectExtension =
          newBlockEffectAudioFile.name.split(".").pop()?.toLowerCase() || "mp3";
        const effectPath =
          "text-effects/" + savedBlock.id + "-" + makeStorageId() + "." + effectExtension;

        const { error: effectUploadError } = await supabase.storage
          .from("audio")
          .upload(effectPath, newBlockEffectAudioFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: newBlockEffectAudioFile.type || undefined,
          });

        if (effectUploadError) {
          setChapterMessage(
            "تم حفظ النص، لكن تعذر رفع المؤثر الصوتي: " + effectUploadError.message
          );
        } else {
          const { error: effectLinkError } = await supabase
            .from("chapter_blocks")
            .update({ effect_audio_path: effectPath })
            .eq("id", savedBlock.id);

          if (effectLinkError) {
            await supabase.storage.from("audio").remove([effectPath]);
            setChapterMessage(
              "تم حفظ النص، لكن تعذر ربط المؤثر الصوتي: " + effectLinkError.message
            );
          } else {
            savedBlock = {
              ...savedBlock,
              effect_audio_path: effectPath,
            };
          }
        }
      }

      setChapterBlocks((current) =>
        [...current, savedBlock].sort(
          (a, b) => a.block_order - b.block_order
        )
      );

      resetBlockForm();
      setChapterMessage(
        safeRow !== Math.max(1, Number(newBlockRow) || 1)
          ? `تمت إضافة العنصر في الصف ${safeRow} لتجنب تغطية عنصر موجود.`
          : "تمت إضافة العنصر."
      );
    } finally {
      setSavingChapterBlocks(false);
    }
  }

  async function deleteChapterBlock(block: ChapterBlock) {
    if (!canManage) return;

    setConfirmDialog({
      message: "هل أنت متأكدة من حذف هذا العنصر؟",
      onConfirm: async () => {

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
      },
    });
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
    if (window.history.state?.fantasyNovelsRoute) {
      window.history.back();
      return;
    }

    activeEffectAudioRef.current?.pause();
    activeEffectAudioRef.current = null;
    setActiveEffectBlockId(null);
    setSelectedChapter(null);
    setChapterBlocks([]);
    setChapterMessage("");
    setChapterImagesVisible(true);
    setChapterImageDimLevel(0);
    setChapterTextShadowLevel(0);
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

    if (user) {
      void loadAccountData();
    }
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

  async function loadAvailableStaffUsers() {
    if (!isOwner) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: { action: "list_users" },
        }
      );

      if (error) {
        setStaffMessage(error.message || "تعذر تحميل المستخدمين.");
        return;
      }

      setAvailableStaffUsers(data?.users ?? []);
    } catch (error: any) {
      setStaffMessage(
        error?.message || "حدث خطأ أثناء تحميل المستخدمين."
      );
    }
  }

  async function addStaff() {
    if (!isOwner) return;

    const selectedUser = availableStaffUsers.find(
      (item) => item.id === selectedStaffUserId
    );

    if (!selectedUser) {
      setStaffMessage("اختاري مستخدمًا أولًا.");
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
            user_id: selectedUser.id,
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

      setSelectedStaffUserId("");
      setStaffMessage(
        data?.message || "تمت إضافة المشرف بنجاح."
      );

      await Promise.all([
        loadStaffMembers(),
        loadAvailableStaffUsers(),
      ]);
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

    setConfirmDialog({
      message: `هل أنت متأكدة من إزالة صلاحية المشرف من ${email}؟`,
      onConfirm: async () => {

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

      await Promise.all([
        loadStaffMembers(),
        loadAvailableStaffUsers(),
      ]);

      await loadStaffMembers();
    } catch (error: any) {
      setStaffMessage(
        error?.message ||
          "حدث خطأ أثناء إزالة صلاحية المشرف."
      );
    } finally {
      setManagingStaff(false);
    }
      },
    });
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

  function parseBlockPlacement(block: ChapterBlock) {
    const raw = String(block.align || "");
    const placementRaw = raw.split("|")[0];
    const parts = placementRaw.split(":");
    if (
      parts.length === 2 &&
      ["left", "right", "full"].includes(parts[0]) &&
      Number(parts[1]) > 0
    ) {
      return {
        column: parts[0] as "left" | "right" | "full",
        row: Number(parts[1]),
      };
    }

    return {
      column:
        placementRaw === "left"
          ? "left"
          : placementRaw === "right"
            ? "right"
            : "full",
      row: Math.max(1, block.block_order),
    };
  }

  function parseTextOverlayPosition(block: ChapterBlock) {
    const match = String(block.align || "").match(/(?:^|\|)textpos:(0|[1-9][0-9]?|100)(?:$|\|)/);
    if (!match) return 50;
    return Number(match[1]);
  }

  function makeBlockAlign(
    column: "left" | "right" | "full",
    row: number,
    textPosition?: number
  ) {
    const base = column + ":" + row;
    if (textPosition === undefined) return base;
    const safe = Math.min(100, Math.max(0, Math.round(textPosition)));
    return base + "|textpos:" + safe;
  }

  function getSafeChapterBlockPlacement(
    block: ChapterBlock,
    requestedColumn: "left" | "right" | "full",
    requestedRow: number
  ) {
    let safeRow = Math.max(1, Number(requestedRow) || 1);

    while (
      chapterBlocks.some((item) => {
        if (item.id === block.id) return false;

        const placement = parseBlockPlacement(item);
        if (placement.row !== safeRow) return false;

        if (requestedColumn === "full") return true;

        return (
          placement.column === "full" ||
          placement.column === requestedColumn
        );
      })
    ) {
      safeRow += 1;
    }

    return {
      column: requestedColumn,
      row: safeRow,
    };
  }

  async function updateChapterBlockPlacement(
    block: ChapterBlock,
    column: "left" | "right" | "full",
    row: number
  ) {
    if (!canManage) return;

    const placement = getSafeChapterBlockPlacement(
      block,
      column,
      row
    );
    const textPosition =
      block.block_type === "text"
        ? parseTextOverlayPosition(block)
        : undefined;
    const align = makeBlockAlign(
      placement.column,
      placement.row,
      textPosition
    );

    const { error } = await supabase
      .from("chapter_blocks")
      .update({ align })
      .eq("id", block.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? { ...item, align } : item
      )
    );

    if (placement.row !== Math.max(1, Number(row) || 1)) {
      setChapterMessage(
        "تم نقل العنصر للصف " +
          placement.row +
          " لتجنب تغطية عنصر موجود."
      );
    }
  }

  async function updateChapterBlockSize(
    block: ChapterBlock,
    width: number | null,
    height: number | null
  ) {
    if (!canManage) return;

    const safeWidth =
      width !== null && Number.isFinite(width) && width > 0
        ? Math.round(width)
        : null;
    const safeHeight =
      height !== null && Number.isFinite(height) && height > 0
        ? Math.round(height)
        : null;

    const { error } = await supabase
      .from("chapter_blocks")
      .update({
        width: safeWidth,
        height: safeHeight,
      })
      .eq("id", block.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id
          ? { ...item, width: safeWidth, height: safeHeight }
          : item
      )
    );
    setChapterMessage("تم حفظ مقاس العنصر.");
  }

  function queueChapterBlockPatch(
    blockId: string,
    patch: Record<string, unknown>,
    delay = 600
  ) {
    const pending = chapterBlockPendingPatchesRef.current.get(blockId) ?? {};
    chapterBlockPendingPatchesRef.current.set(blockId, {
      ...pending,
      ...patch,
    });

    const existingTimer = chapterBlockPatchTimersRef.current.get(blockId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(async () => {
      chapterBlockPatchTimersRef.current.delete(blockId);

      const nextPatch =
        chapterBlockPendingPatchesRef.current.get(blockId) ?? {};
      chapterBlockPendingPatchesRef.current.delete(blockId);

      const { error } = await supabase
        .from("chapter_blocks")
        .update(nextPatch)
        .eq("id", blockId);

      if (error) {
        setChapterMessage(error.message);
      }
    }, delay);

    chapterBlockPatchTimersRef.current.set(blockId, timer);
  }

  async function updateChapterBlockContent(
    block: ChapterBlock,
    content: string
  ) {
    if (!canManage || !["text", "heading", "quote"].includes(block.block_type)) {
      return;
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? { ...item, content } : item
      )
    );

    queueChapterBlockPatch(block.id, { content }, 700);
  }

  function updateChapterBlockTextOverlayOpacity(
    block: ChapterBlock,
    value: number
  ) {
    if (!canManage || block.block_type !== "text") return;

    const safeOpacity = Math.min(1, Math.max(0, Number(value)));

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id
          ? { ...item, text_overlay_opacity: safeOpacity }
          : item
      )
    );

    queueChapterBlockPatch(
      block.id,
      { text_overlay_opacity: safeOpacity },
      500
    );
  }
  async function updateChapterBlockObjectPosition(
    block: ChapterBlock,
    x: number,
    y: number
  ) {
    if (!canManage) return;

    const safeX = Math.min(100, Math.max(0, Math.round(x)));
    const safeY = Math.min(100, Math.max(0, Math.round(y)));
    const object_position = safeX + "% " + safeY + "%";

    const { error } = await supabase
      .from("chapter_blocks")
      .update({ object_position })
      .eq("id", block.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? { ...item, object_position } : item
      )
    );
  }

  function changeChapterBlockDirection(
    block: ChapterBlock,
    direction: "left" | "right" | "up" | "down"
  ) {
    const placement = parseBlockPlacement(block);

    if (direction === "up" || direction === "down") {
      const nextRow = Math.max(
        1,
        placement.row + (direction === "up" ? -1 : 1)
      );
      void updateChapterBlockPlacement(
        block,
        placement.column,
        nextRow
      );
      return;
    }

    const nextColumn =
      placement.column === "full"
        ? direction === "left"
          ? "left"
          : "right"
        : direction === "left"
          ? "left"
          : "right";

    void updateChapterBlockPlacement(
      block,
      nextColumn,
      placement.row
    );
  }

  async function toggleChapterEffectAudio(block: ChapterBlock) {
    if (!block.effect_audio_path) return;

    if (
      activeEffectBlockId === block.id &&
      activeEffectAudioRef.current
    ) {
      activeEffectAudioRef.current.pause();
      activeEffectAudioRef.current.currentTime = 0;
      activeEffectAudioRef.current = null;
      setActiveEffectBlockId(null);
      return;
    }

    activeEffectAudioRef.current?.pause();
    if (activeEffectAudioRef.current) {
      activeEffectAudioRef.current.currentTime = 0;
    }

    const url = getPublicMediaUrl("audio", block.effect_audio_path);
    if (!url) return;

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.onended = () => {
      if (activeEffectAudioRef.current === audio) {
        activeEffectAudioRef.current = null;
        setActiveEffectBlockId(null);
      }
    };

    activeEffectAudioRef.current = audio;
    setActiveEffectBlockId(block.id);

    try {
      await audio.play();
    } catch {
      if (activeEffectAudioRef.current === audio) {
        activeEffectAudioRef.current = null;
        setActiveEffectBlockId(null);
      }
    }
  }

  async function updateTextSceneProperty(
    block: ChapterBlock,
    patch: Partial<Pick<
      ChapterBlock,
      "text_position_x" |
      "text_position_y" |
      "text_font_size" |
      "text_color" |
      "text_align" |
      "text_width_percent" |
      "text_height_percent" |
      "text_image_scale_percent"
    >>
  ) {
    if (!canManage || block.block_type !== "text") return;

    const safePatch: Record<string, unknown> = { ...patch };

    if (patch.text_position_x !== undefined) {
      safePatch.text_position_x = Math.min(100, Math.max(0, Number(patch.text_position_x)));
    }
    if (patch.text_position_y !== undefined) {
      safePatch.text_position_y = Math.min(100, Math.max(0, Number(patch.text_position_y)));
    }
    if (patch.text_font_size !== undefined) {
      safePatch.text_font_size = Math.min(64, Math.max(12, Number(patch.text_font_size)));
    }
    if (patch.text_width_percent !== undefined) {
      safePatch.text_width_percent = Math.min(100, Math.max(60, Number(patch.text_width_percent)));
    }
    if (patch.text_height_percent !== undefined) {
      safePatch.text_height_percent = Math.min(100, Math.max(30, Number(patch.text_height_percent)));
    }
    if (patch.text_image_scale_percent !== undefined) {
      safePatch.text_image_scale_percent = Math.min(
        140,
        Math.max(100, Number(patch.text_image_scale_percent))
      );
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? { ...item, ...safePatch } : item
      )
    );

    queueChapterBlockPatch(block.id, safePatch, 500);
  }

  async function uploadEffectAudio(block: ChapterBlock, file: File | null) {
    if (!canManage || block.block_type !== "text" || !file) return;

    setUploadingEffectAudioId(block.id);
    setChapterMessage("");

    try {
      const validationError = validateStorageUpload(file, "audio");
      if (validationError) {
        setChapterMessage(validationError);
        return;
      }

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = "text-effects/" + block.id + "-" + makeStorageId() + "." + extension;

      const { error } = await supabase.storage
        .from("audio")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (error) {
        setChapterMessage("تعذر رفع المؤثر: " + error.message);
        return;
      }

      if (block.effect_audio_path) {
        await supabase.storage
          .from("audio")
          .remove([block.effect_audio_path]);
      }

      const { error: updateError } = await supabase
        .from("chapter_blocks")
        .update({ effect_audio_path: path })
        .eq("id", block.id);

      if (updateError) {
        setChapterMessage(updateError.message);
        return;
      }

      setChapterBlocks((current) =>
        current.map((item) =>
          item.id === block.id
            ? { ...item, effect_audio_path: path }
            : item
        )
      );
      setChapterMessage("تم ربط المؤثر الصوتي بهذا النص.");
    } finally {
      setUploadingEffectAudioId(null);
    }
  }

  async function removeEffectAudio(block: ChapterBlock) {
    if (!canManage || block.block_type !== "text") return;

    activeEffectAudioRef.current?.pause();
    activeEffectAudioRef.current = null;
    setActiveEffectBlockId(null);

    if (block.effect_audio_path) {
      await supabase.storage
        .from("audio")
        .remove([block.effect_audio_path]);
    }

    const { error } = await supabase
      .from("chapter_blocks")
      .update({ effect_audio_path: null })
      .eq("id", block.id);

    if (error) {
      setChapterMessage(error.message);
      return;
    }

    setChapterBlocks((current) =>
      current.map((item) =>
        item.id === block.id
          ? { ...item, effect_audio_path: null }
          : item
      )
    );
    setChapterMessage("تم حذف المؤثر الصوتي من النص.");
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
      objectFit:
        block.width && block.height
          ? "cover"
          : "contain",
       objectPosition: block.object_position || "50% 50%",
    };

    const textSizeStyle: React.CSSProperties = {
      width:
        block.width && block.width > 0
          ? `${block.width}px`
          : undefined,
      minHeight:
        block.height && block.height > 0
          ? `${block.height}px`
          : undefined,
      maxWidth: "100%",
    };

    const placement = parseBlockPlacement(block);
    const alignClass =
      placement.column === "right"
        ? "block-align-right"
        : placement.column === "left"
          ? "block-align-left"
          : "block-align-full";

    if (block.block_type === "heading") {
      return (
        <h2
          key={block.id}
          className={`chapter-heading ${alignClass}`}
          style={textSizeStyle}
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
          style={textSizeStyle}
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
      if (reader && !chapterImagesVisible) {
        return null;
      }

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
              style={{
                width: "min(100%, 560px)",
                maxWidth: "100%",
              }}
            />
          ) : (
            <div className="empty-media">
              لم يتم العثور على الملف الصوتي.
            </div>
          )}
        </div>
      );
    }

    if (block.block_type === "text" && mediaUrl) {
      const textX = Math.min(100, Math.max(0, Number(block.text_position_x ?? 50)));
      const textY = Math.min(100, Math.max(0, Number(block.text_position_y ?? 50)));
      const textWidth = Math.min(100, Math.max(25, Number(block.text_width_percent ?? 100)));
      const textHeight = Math.min(100, Math.max(30, Number(block.text_height_percent ?? 100)));
      const textColor = block.text_color || "#ffffff";
      const textAlign =
        block.text_align === "left" ||
        block.text_align === "center" ||
        block.text_align === "right"
          ? block.text_align
          : "right";

      return (
        <TextSceneReader
          key={block.id}
          src={mediaUrl}
          content={block.content || ""}
          positionX={textX}
          positionY={textY}
          color={textColor}
          textAlign={textAlign}
          widthPercent={textWidth}
          heightPercent={textHeight}
          readerFontSize={readerFontSize}
          textVisible={chapterTextVisible}
          imageVisible={chapterImagesVisible}
          imageDimLevel={chapterImageDimLevel}
          textShadowLevel={chapterTextShadowLevel}
          effectAudioPath={block.effect_audio_path}
          effectAudioPlaying={activeEffectBlockId === block.id}
          onToggleEffectAudio={() => void toggleChapterEffectAudio(block)}
        />
      );
    }
    return (
      <p
        key={block.id}
        className={`chapter-text ${alignClass}`}
        dir={selectedNovel?.direction || "rtl"}
        style={textSizeStyle}
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
            className="secondary-button full-width google-auth-button"
            onClick={signInWithGoogle}
            disabled={authLoading}
          >
            الدخول باستخدام Google
          </button>

          <div className="auth-switch">
            {authMode === "login" ? (
              <>
                <span>ليس لديك حساب؟</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthMessage("");
                  }}
                >
                  إنشاء حساب
                </button>
              </>
            ) : (
              <>
                <span>لديك حساب بالفعل؟</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthMessage("");
                  }}
                >
                  تسجيل الدخول
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderHeader() {
    return (
      <>
        <header className="site-header">
          <div className="header-inner">
            <button
              className="brand-button"
              onClick={goHome}
            >
              <span className="brand-mark">✦</span>
              <span>روايات خيالية</span>
            </button>

            <div className="header-actions">
              {user && (
                <button
                  type="button"
                  className="notification-bell-button"
                  onClick={() => openAccount("notifications")}
                  aria-label="الإشعارات"
                  title="الإشعارات"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                  </svg>
                  {unreadNotifications > 0 && (
                    <span className="notification-bell-badge">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                className="menu-button"
                onClick={() => setShowSideMenu(true)}
                aria-label="فتح القائمة"
                aria-expanded={showSideMenu}
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>
        </header>

        {showSideMenu && (
          <div className="side-menu-layer">
            <button
              className="side-menu-backdrop"
              aria-label="إغلاق القائمة"
              onClick={() => setShowSideMenu(false)}
            />

            <aside className="side-menu" aria-label="القائمة الرئيسية">
              <div className="side-menu-profile">
                {user ? (
                  <button
                    type="button"
                    className="side-profile-button"
                    onClick={() => {
                      setShowSideMenu(false);
                      openAccount("profile");
                    }}
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="صورة الحساب"
                        className="side-profile-avatar"
                      />
                    ) : (
                      <span className="side-profile-avatar side-profile-placeholder">
                        {profile?.display_name?.charAt(0) || "👤"}
                      </span>
                    )}
                    <span>
                      <strong>{profile?.display_name || "حسابي"}</strong>
                      <small>الملف الشخصي</small>
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="side-profile-button"
                    onClick={() => {
                      setShowSideMenu(false);
                      setShowAccount(true);
                      setShowNovels(false);
                      setShowAdmin(false);
                    }}
                  >
                    <span className="side-profile-avatar side-profile-placeholder">👤</span>
                    <span>
                      <strong>تسجيل الدخول</strong>
                      <small>الدخول إلى حسابك</small>
                    </span>
                  </button>
                )}
              </div>

              <nav className="side-menu-nav">
                <button
                  type="button"
                  onClick={() => {
                    setShowSideMenu(false);
                    goHome();
                  }}
                >
                  <span className="side-menu-icon side-menu-home-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 10.5 12 3.8l8.5 6.7" />
                      <path d="M5.5 9.5v10h13v-10" />
                      <path d="M9.5 19.5v-6h5v6" />
                    </svg>
                  </span>
                  <span>الرئيسية</span>
                </button>

                {user && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSideMenu(false);
                        openAccount("favorites");
                      }}
                    >
                      <span className="side-menu-icon">♥</span>
                      <span>المفضلة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSideMenu(false);
                        openAccount("history");
                      }}
                    >
                      <span className="side-menu-icon side-menu-history-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                          <circle cx="12" cy="12" r="2.6" />
                        </svg>
                      </span>
                      <span>آخر المشاهدات</span>
                    </button>
                  </>
                )}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSideMenu(false);
                      openAdmin();
                    }}
                  >
                    <span className="side-menu-icon">▣</span>
                    <span>لوحة الإدارة</span>
                  </button>
                )}

                {user && (
                  <div className="side-owner-card" aria-label="المالك">
                    {ownerProfile?.avatar_url ? (
                      <img
                        src={ownerProfile.avatar_url}
                        alt="المالك"
                        className="side-owner-avatar"
                      />
                    ) : (
                      <span className="side-owner-avatar side-profile-placeholder">👤</span>
                    )}
                    <span>المالك</span>
                  </div>
                )}

                {user && (
                  <button
                    type="button"
                    className="side-menu-logout"
                    onClick={() => {
                      setShowSideMenu(false);
                      logout();
                    }}
                  >
                    <span className="side-menu-icon">↪</span>
                    <span>تسجيل الخروج</span>
                  </button>
                )}
              </nav>
            </aside>
          </div>
        )}
      </>
    );
  }

  function renderNovelCard(novel: Novel, activityLabel?: string) {
    const favorite = isFavorite(novel.id);
    const image = coverUrl(novel);

    return (
      <article
        key={novel.id}
        className={
          "novel-card" + (activityLabel ? " novel-card-new-release" : "")
        }
        onClick={() => openNovel(novel, false)}
      >
        {activityLabel && (
          <span className="novel-new-badge">{activityLabel}</span>
        )}

        <div className="novel-cover">
          {image ? (
            <img
              src={image}
              alt={novel.title}
              style={{
                objectPosition: novel.cover_position || "50% 50%",
              }}
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

          {(novel.novel_categories?.length || novel.categories?.name) && (
            <div className="novel-category">
              {(novel.novel_categories?.length
                ? novel.novel_categories.map((item) => item.category.name)
                : novel.categories?.name
                  ? [novel.categories.name]
                  : []
              ).join(" · ")}
            </div>
          )}

          {novel.description && (
            <div className="novel-card-description">
              <span>وصف</span>
              <p>{novel.description}</p>
            </div>
          )}

          <div className="novel-meta">
            <span>
              {novel.status === "ongoing"
                ? "مستمرة"
                : "مكتملة"}
            </span>

            <span>{novel.language}</span>

            <span className="novel-reader-count">
              👥 {novel.reader_count ?? 0} قرّاء
            </span>
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

        {newReleaseNovels.length > 0 && (
          <section className="new-releases-section">
            <div className="section-heading new-releases-heading">
              <div>
                <span className="eyebrow">آخر ما نُشر</span>
                <h2>الروايات الجديدة</h2>
              </div>
              <span className="count-badge">{newReleaseNovels.length}</span>
            </div>

            <div className="new-releases-grid">
              {newReleaseNovels.map(({ novel, activityLabel }) =>
                renderNovelCard(novel, activityLabel)
              )}
            </div>
          </section>
        )}

        <div className="library-tools card">
          <form
            className="library-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery((current) => current.trim());
            }}
          >
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="بحث عن رواية أو وصف..."
              aria-label="بحث في الروايات"
            />
            <button
              type="submit"
              className="library-search-button"
              aria-label="بحث"
              title="بحث"
            >
              ⌕
            </button>
          </form>

          <div className="library-filters">
            <button
              className={selectedCategoryFilter.length === 0 ? "category-filter-button active" : "category-filter-button"}
              onClick={() => {
                setSelectedCategoryFilter([]);
                setShowCategoryFilter(false);
              }}
            >
              الكل
            </button>

            <div className="category-filter-menu">
              <button
                type="button"
                className="category-filter-button"
                onClick={() => setShowCategoryFilter((open) => !open)}
                aria-expanded={showCategoryFilter}
                aria-haspopup="true"
              >
                <span>التصنيفات</span>
                {selectedCategoryFilter.length > 0 && (
                  <span className="category-filter-count">
                    {selectedCategoryFilter.length}
                  </span>
                )}
                <span className="category-filter-arrow" aria-hidden="true">
                  {showCategoryFilter ? "⌃" : "⌄"}
                </span>
              </button>

              {showCategoryFilter && (
                <div className="category-filter-dropdown">
                  <div className="category-filter-dropdown-title">
                    اختاري تصنيفًا أو أكثر
                  </div>

                  {selectedCategoryFilter.length > 0 && (
                    <button
                      type="button"
                      className="category-filter-clear"
                      onClick={() => setSelectedCategoryFilter([])}
                    >
                      مسح الاختيارات
                    </button>
                  )}

                  {categories.map((category) => {
                    const checked = selectedCategoryFilter.includes(category.id);

                    return (
                      <label key={category.id} className="category-filter-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedCategoryFilter((current) =>
                              current.includes(category.id)
                                ? current.filter((id) => id !== category.id)
                                : [...current, category.id]
                            );
                          }}
                        />
                        <span className="category-filter-check" aria-hidden="true">
                          {checked ? "✓" : ""}
                        </span>
                        <span className="category-filter-name">
                          {category.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <select
              value={selectedStatusFilter}
              onChange={(event) => setSelectedStatusFilter(event.target.value)}
              aria-label="حالة الرواية"
            >
              <option value="all">الحالات</option>
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
            <label>التصنيفات (يمكن اختيار أكثر من تصنيف)</label>
            <select
              value={novelCategories}
              multiple
              size={5}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map(
                  (option) => option.value
                );
                setNovelCategories(selected);
              }}
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

            {novelCoverPath && (
              <CoverCropEditor
                src={coverUrl({ cover_path: novelCoverPath } as Novel)}
                positionX={parseObjectPosition(novelCoverPosition).x}
                positionY={parseObjectPosition(novelCoverPosition).y}
                onChangePosition={(x, y) =>
                  setNovelCoverPosition(x + "% " + y + "%")
                }
              />
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
                  setNewBlockEffectAudioFile(null);
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

            {newBlockType === "text" && (
              <div className="form-group form-group-full text-effect-inline-form">
                <label>مؤثر صوتي مرتبط بهذا النص</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (file) {
                      setNewBlockEffectAudioFile(file);
                      setChapterMessage("تم اختيار المؤثر الصوتي — اضغطي حفظ لإضافته مع النص.");
                    }
                  }}
                />
                {newBlockEffectAudioFile && (
                  <small className="form-hint">
                    المؤثر الجاهز: {newBlockEffectAudioFile.name}
                  </small>
                )}
              </div>
            )}

            {["image", "gif", "audio", "text"].includes(
              newBlockType
            ) && (
              <>
                <div className="form-group form-group-full">
                  <label>
                    {newBlockType === "audio"
                      ? "الملف الصوتي"
                      : newBlockType === "gif"
                        ? "صورة GIF"
                         : newBlockType === "text"
                           ? "صورة خلفية للنص"
                        : "الصورة"}
                  </label>

                  <input
                    type="file"
                    accept={
                      newBlockType === "audio"
                        ? "audio/*"
                        : newBlockType === "gif"
                          ? undefined
                          : "image/*,.webp,.gif,.png,.jpg,.jpeg"
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
                    <label>نوع الصوت</label>

                    <select
                      value={newBlockAudioType}
                      onChange={(event) =>
                        setNewBlockAudioType(
                          event.target.value as "reader" | "effects"
                        )
                      }
                    >
                      <option value="reader">القارئ</option>
                      <option value="effects">مؤثرات صوتية</option>
                    </select>

                    <label className="audio-name-label">
                      اسم الصوت
                    </label>

                    <input
                      value={newBlockMediaLabel}
                      onChange={(event) =>
                        setNewBlockMediaLabel(
                          event.target.value
                        )
                      }
                      placeholder={
                        newBlockAudioType === "reader"
                          ? "مثال: القارئ أحمد"
                          : "مثال: صوت المطر"
                      }
                    />

                    <small className="form-hint">
                      سيظهر النوع قبل اسم الصوت، مثل:
                      «القارئ — أحمد» أو «مؤثرات صوتية — المطر».
                    </small>
                  </div>
                )}                {newBlockType === "text" &&
                  newBlockMediaPreviewUrl &&
                  newBlockContent.trim() && (
                    <div className="form-group form-group-full">
                      <label>معاينة المشهد قبل الحفظ</label>
                      <TextSceneEditor
                        src={newBlockMediaPreviewUrl}
                        content={newBlockContent}
                        positionX={Number(newBlockTextPosition)}
                        positionY={newTextPositionY}
                        fontSize={newTextFontSize}
                        color={newTextColor}
                        textAlign={newTextAlign}
                        widthPercent={newTextWidthPercent}
                        onChangePosition={(x, y) => {
                          setNewBlockTextPosition(String(x));
                          setNewTextPositionY(y);
                        }}
                        onChangeFontSize={setNewTextFontSize}
                        onChangeColor={setNewTextColor}
                        onChangeAlign={setNewTextAlign}
                        onChangeWidth={setNewTextWidthPercent}
                      />
                    </div>
                  )}

                {newBlockType === "text" && (
                  <div className="form-group">
                    <label>مكان النص فوق الصورة</label>
                    <select
                      value={newBlockTextPosition}
                      onChange={(event) =>
                        setNewBlockTextPosition(event.target.value)
                      }
                    >
                      <option value="100">أقصى اليمين</option>
                      <option value="75">يمين</option>
                      <option value="50">منتصف</option>
                      <option value="25">يسار</option>
                      <option value="0">أقصى اليسار</option>
                    </select>
                    <small className="form-hint">
                      هذا يحرّك النص فوق الصورة فقط، ولا يغيّر عمود العنصر.
                    </small>
                  </div>
                )}

                <div className="form-group">
                  <label>العمود</label>
                  <select
                    value={newBlockColumn}
                    onChange={(event) =>
                      setNewBlockColumn(
                        event.target.value as "left" | "right" | "full"
                      )
                    }
                  >
                    <option value="right">العمود الأيمن</option>
                    <option value="left">العمود الأيسر</option>
                    <option value="full">عرض كامل</option>
                  </select>
                  <small className="form-hint">
                    هذا يحدد مكان العنصر داخل الصفحة، وليس مجرد محاذاة.
                  </small>
                </div>

                <div className="form-group">
                  <label>رقم الصف</label>
                  <input
                    type="number"
                    min="1"
                    value={newBlockRow}
                    onChange={(event) => setNewBlockRow(event.target.value)}
                    placeholder="1"
                  />
                  <small className="form-hint">
                    العناصر التي تحمل نفس رقم الصف تظهر بجانب بعضها. مثال: نص يسار + صورة يمين في الصف 2.
                  </small>
                </div>

                <div className="form-group form-group-full">
                  <small className="form-hint">
                    الصورة تبقى كما رُفعت بدون قص أو تمديد، ويمكن للقارئ تمرير النص وتكبيره أو تصغيره أثناء القراءة.
                  </small>
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

                  {(block.block_type === "text" ||
                    block.block_type === "heading" ||
                    block.block_type === "quote") && canManage && (
                    <div className="editor-text-content-editor">
                      <label>
                        تعديل النص
                        <textarea
                          value={block.content || ""}
                          rows={4}
                          onChange={(event) =>
                            void updateChapterBlockContent(
                              block,
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  )}

                  <div className="editor-block-placement">
                    {(() => {
                      const placement = parseBlockPlacement(block);
                      const isMedia =
                        block.block_type === "image" ||
                        block.block_type === "gif" ||
                        block.block_type === "audio";
                       const isText =
                         block.block_type === "text" ||
                         block.block_type === "heading" ||
                         block.block_type === "quote";

                      return (
                        <>
                          <div className="editor-move-controls">
                            <span className="editor-control-title">
                              مكان العنصر
                            </span>
                            <div className="editor-arrow-row">
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  changeChapterBlockDirection(block, "right")
                                }
                                title="تحريك لليمين"
                              >
                                →
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  changeChapterBlockDirection(block, "down")
                                }
                                title="تحريك لأسفل"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  changeChapterBlockDirection(block, "up")
                                }
                                title="تحريك لأعلى"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() =>
                                  changeChapterBlockDirection(block, "left")
                                }
                                title="تحريك لليسار"
                              >
                                ←
                              </button>
                            </div>
                          </div>

                          <label>
                            العمود
                            <select
                              value={placement.column}
                              onChange={(event) =>
                                updateChapterBlockPlacement(
                                  block,
                                  event.target.value as "left" | "right" | "full",
                                  placement.row
                                )
                              }
                            >
                              <option value="right">اليمين</option>
                              <option value="left">اليسار</option>
                              <option value="full">عرض كامل</option>
                            </select>
                          </label>

                          <label>
                            الصف
                            <input
                              type="number"
                              min="1"
                              value={placement.row}
                              onChange={(event) =>
                                updateChapterBlockPlacement(
                                  block,
                                  placement.column,
                                  Number(event.target.value)
                                )
                              }
                            />
                          </label>

                          {isMedia && (
                            <>
                              {block.block_type === "image" ||
                              block.block_type === "gif" ? (
                                block.media_path ? (
                                  <ImageCropEditor
                                    src={getPublicMediaUrl(
                                      "chapter-media",
                                      block.media_path
                                    )}
                                    width={block.width}
                                    height={block.height}
                                    objectPosition={block.object_position}
                                    onSaveSize={(nextWidth, nextHeight) =>
                                      updateChapterBlockSize(
                                        block,
                                        nextWidth,
                                        nextHeight
                                      )
                                    }
                                    onSavePosition={(x, y) =>
                                      updateChapterBlockObjectPosition(
                                        block,
                                        x,
                                        y
                                      )
                                    }
                                  />
                                ) : null
                              ) : (
                                <>
                                  <label>
                                    العرض بالبكسل
                                    <input
                                      type="number"
                                      min="1"
                                      value={block.width ?? ""}
                                      placeholder="تلقائي"
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        void updateChapterBlockSize(
                                          block,
                                          value ? Number(value) : null,
                                          block.height
                                        );
                                      }}
                                    />
                                  </label>

                                  <label>
                                    الارتفاع بالبكسل
                                    <input
                                      type="number"
                                      min="1"
                                      value={block.height ?? ""}
                                      placeholder="تلقائي"
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        void updateChapterBlockSize(
                                          block,
                                          block.width,
                                          value ? Number(value) : null
                                        );
                                      }}
                                    />
                                  </label>
                                </>
                              )}
                            </>
                          )}


                          {isText && (
                            <>
                              {block.block_type === "text" && block.media_path && (
                                <label className="text-overlay-position-control">
                                  مكان النص فوق الصورة
                                  <select
                                    value={String(parseTextOverlayPosition(block))}
                                    onChange={(event) => {
                                      const value = Number(event.target.value);
                                      void updateTextSceneProperty(block, {
                                        text_position_x: value,
                                      });
                                    }}
                                  >
                                    <option value="100">أقصى اليمين</option>
                                    <option value="75">يمين</option>
                                    <option value="50">منتصف</option>
                                    <option value="25">يسار</option>
                                    <option value="0">أقصى اليسار</option>
                                  </select>
                                </label>
                              )}

                              <TextResizeEditor
                                width={block.width}
                                height={block.height}
                                onSaveSize={(nextWidth, nextHeight) =>
                                  updateChapterBlockSize(
                                    block,
                                    nextWidth,
                                    nextHeight
                                  )
                                }
                              />

                              {block.media_path && block.block_type === "text" && (
                                <>
                                  <label className="text-overlay-opacity-control">
                                    وضوح النص فوق الصورة — {Math.round(
                                      (block.text_overlay_opacity ?? 0.24) * 100
                                    )}%
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={Math.round(
                                        (block.text_overlay_opacity ?? 0.24) * 100
                                      )}
                                      onChange={(event) => {
                                        void updateChapterBlockTextOverlayOpacity(
                                          block,
                                          Number(event.target.value) / 100
                                        );
                                      }}
                                    />
                                  </label>

                                  <div className="text-effect-audio-editor">
                                    <strong>المؤثر الصوتي لهذا النص</strong>

                                    {block.effect_audio_path ? (
                                      <div className="text-effect-audio-current">
                                        <audio
                                          controls
                                          preload="metadata"
                                          src={getPublicMediaUrl(
                                            "audio",
                                            block.effect_audio_path
                                          )}
                                        />
                                        <button
                                          type="button"
                                          className="danger-button"
                                          onClick={() =>
                                            void removeEffectAudio(block)
                                          }
                                        >
                                          حذف المؤثر
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="editor-placement-hint">
                                        لا يوجد مؤثر مرتبط بهذا النص.
                                      </span>
                                    )}

                                    <label className="secondary-button text-effect-upload">
                                      {uploadingEffectAudioId === block.id
                                        ? "جارٍ رفع المؤثر..."
                                        : block.effect_audio_path
                                          ? "تغيير المؤثر"
                                          : "إضافة مؤثر صوتي"}
                                      <input
                                        type="file"
                                        accept="audio/*"
                                        hidden
                                        disabled={uploadingEffectAudioId === block.id}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0] || null;
                                          event.currentTarget.value = "";
                                          if (file) {
                                            void uploadEffectAudio(block, file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                </>
                              )}
                            </>
                          )}

                           <span className="editor-placement-hint">
                             الأسهم تحرك العنصر وتحفظ مكانه فورًا. المقاس يتم ضبطه بالسحب من الزوايا.
                           </span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="editor-block-preview">
                    {block.block_type === "text" && block.media_path ? (
                      <TextSceneEditor
                        src={getPublicMediaUrl(
                          "chapter-media",
                          block.media_path
                        )}
                        content={block.content || ""}
                        positionX={Number(block.text_position_x ?? 50)}
                        positionY={Number(block.text_position_y ?? 50)}
                        fontSize={Number(block.text_font_size ?? 18)}
                        color={block.text_color || "#ffffff"}
                        textAlign={
                          block.text_align === "left" ||
                          block.text_align === "center" ||
                          block.text_align === "right"
                            ? block.text_align
                            : "right"
                        }
                        widthPercent={Number(block.text_width_percent ?? 100)}
                        heightPercent={Number(block.text_height_percent ?? 100)}
                        onChangePosition={(x, y) =>
                          void updateTextSceneProperty(block, {
                            text_position_x: x,
                            text_position_y: y,
                          })
                        }
                        onChangeFontSize={(size) =>
                          void updateTextSceneProperty(block, {
                            text_font_size: size,
                          })
                        }
                        onChangeColor={(color) =>
                          void updateTextSceneProperty(block, {
                            text_color: color,
                          })
                        }
                        onChangeAlign={(align) =>
                          void updateTextSceneProperty(block, {
                            text_align: align,
                          })
                        }
                        onChangeWidth={(width) =>
                          void updateTextSceneProperty(block, {
                            text_width_percent: width,
                          })
                        }
                        onChangeHeight={(height) =>
                          void updateTextSceneProperty(block, {
                            text_height_percent: height,
                          })
                        }
                        effectAudioPath={block.effect_audio_path}
                        effectAudioPlaying={activeEffectBlockId === block.id}
                        onToggleEffectAudio={() => void toggleChapterEffectAudio(block)}
                      />
                    ) : (
                      renderChapterBlock(block, false)
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

            <div className="chapter-reader-text-tools" aria-label="أدوات النص">
              <div className="chapter-reader-font-control">
                <span>حجم النص</span>
                <button
                  type="button"
                  className="reader-font-button"
                  onClick={() =>
                    setReaderFontSize((current) =>
                      Math.max(12, current - 2)
                    )
                  }
                  aria-label="تصغير الخط"
                  title="تصغير الخط"
                >
                  −
                </button>
                <output>{clampTextFontSize(readerFontSize)}px</output>
                <button
                  type="button"
                  className="reader-font-button"
                  onClick={() =>
                    setReaderFontSize((current) =>
                      Math.min(64, current + 2)
                    )
                  }
                  aria-label="تكبير الخط"
                  title="تكبير الخط"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className={
                  "chapter-reader-visibility-button" +
                  (chapterTextVisible ? "" : " is-hidden")
                }
                onClick={() =>
                  setChapterTextVisible((current) => !current)
                }
                aria-pressed={!chapterTextVisible}
                title={
                  chapterTextVisible
                    ? "إخفاء النص لرؤية الخلفية"
                    : "إظهار النص"
                }
              >
                {chapterTextVisible ? "إخفاء النص" : "إظهار النص"}
              </button>

              <button
                type="button"
                className={
                  "chapter-reader-visibility-button" +
                  (chapterImagesVisible ? "" : " is-hidden")
                }
                onClick={() =>
                  setChapterImagesVisible((current) => !current)
                }
                aria-pressed={!chapterImagesVisible}
                title={
                  chapterImagesVisible
                    ? "إخفاء الصور"
                    : "إظهار الصور"
                }
              >
                {chapterImagesVisible ? "إخفاء الصور" : "إظهار الصور"}
              </button>

              <div className="chapter-reader-dim-controls" aria-label="خيارات التعتيم">
                <label className="chapter-reader-dim-control">
                  <span>تعتيم الصورة</span>
                  <select
                    value={chapterImageDimLevel}
                    onChange={(event) =>
                      setChapterImageDimLevel(Number(event.target.value))
                    }
                    aria-label="درجة تعتيم الصورة"
                  >
                    <option value={0}>بدون</option>
                    <option value={1}>خفيف</option>
                    <option value={2}>متوسط</option>
                    <option value={3}>قوي</option>
                    <option value={4}>شديد</option>
                  </select>
                </label>

                <label className="chapter-reader-dim-control">
                  <span>ظل النص</span>
                  <select
                    value={chapterTextShadowLevel}
                    onChange={(event) =>
                      setChapterTextShadowLevel(Number(event.target.value))
                    }
                    aria-label="درجة ظل النص"
                  >
                    <option value={0}>بدون</option>
                    <option value={1}>خفيف</option>
                    <option value={2}>متوسط</option>
                    <option value={3}>قوي</option>
                    <option value={4}>شديد</option>
                  </select>
                </label>
              </div>
            </div>

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
              {readerBlocks.map((block) => {
                const placement = parseBlockPlacement(block);
                return (
                  <div
                    key={block.id}
                    className={
                      "chapter-layout-item" +
                      (block.block_type === "text" && block.media_path
                        ? " chapter-layout-item-text-image"
                        : "")
                    }
                    style={{
                      gridColumn:
                        placement.column === "full"
                          ? "1 / -1"
                          : placement.column === "right"
                            ? "1"
                            : "2",
                      gridRow: placement.row,
                    }}
                  >
                    {renderChapterBlock(block)}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {!selectedNovelAdminView && selectedChapter && (
          <ChapterExtras chapterId={selectedChapter.id} canManage={canManage} isOwner={isOwner} />
        )}

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
          onClick={() => {
            if (window.history.state?.fantasyNovelsRoute) {
              window.history.back();
              return;
            }
            goHome();
          }}
        >
          ← العودة للروايات
        </button>

        <div className="novel-hero card">
          <div className="novel-hero-cover">
            {image ? (
              <button
                type="button"
                className="novel-hero-cover-button"
                onClick={() => setShowFullCover(true)}
                aria-label="عرض غلاف الرواية كاملًا"
                title="عرض الصورة كاملة"
              >
                <img
                  src={image}
                  alt={selectedNovel.title}
                  style={{
                    objectPosition: selectedNovel.cover_position || "50% 50%",
                  }}
                />
                <span className="novel-cover-view-hint">
                  عرض الصورة كاملة
                </span>
              </button>
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

        {showFullCover && image && (
          <div
            className="novel-cover-modal"
            role="dialog"
            aria-modal="true"
            aria-label="غلاف الرواية كاملًا"
            onClick={() => setShowFullCover(false)}
          >
            <button
              type="button"
              className="novel-cover-modal-close"
              onClick={(event) => {
                event.stopPropagation();
                setShowFullCover(false);
              }}
              aria-label="إغلاق الصورة"
            >
              ×
            </button>

            <img
              src={image}
              alt={selectedNovel.title}
              className="novel-cover-full-image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}

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
                    const nextChapterNumber =
                      chapters.length > 0
                        ? Math.max(
                            ...chapters.map((chapter) => chapter.chapter_number)
                          ) + 1
                        : 1;
                    setChapterNumber(String(nextChapterNumber));
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
                  className={
                    "chapter-card" +
                    (readChapterIds.has(chapter.id) ? " is-read" : "")
                  }
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

                    <span className="chapter-statuses">
                      {isChapterNew(chapter, currentTimeMs) && (
                        <span className="chapter-new-badge">جديد</span>
                      )}
                      {readChapterIds.has(chapter.id) && (
                        <span className="chapter-read-badge">شاهدت هذا الفصل</span>
                      )}
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
                          type="button"
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            editChapter(chapter);
                          }}
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
              <span className="eyebrow">المكتبة</span>
              <h2>إدارة الروايات</h2>
            </div>
            <span className="count-badge">{novels.length}</span>
          </div>

          <div className="admin-novel-search">
            <span className="admin-novel-search-icon">⌕</span>
            <input
              value={adminNovelSearch}
              onChange={(event) => setAdminNovelSearch(event.target.value)}
              placeholder="بحث عن رواية تريدين تعديلها..."
              aria-label="بحث عن رواية في الإدارة"
            />
          </div>

          {novels.length === 0 ? (
            <div className="empty-state">لا توجد روايات بعد.</div>
          ) : filteredAdminNovels.length === 0 ? (
            <div className="empty-state">لا توجد رواية مطابقة للبحث.</div>
          ) : (
            <div className="admin-novel-list">
              {filteredAdminNovels.map((novel) => (
                <article className="admin-novel-row" key={novel.id}>
                  <div className="admin-novel-cover-wrap">
                    {novel.cover_path ? (
                      <img
                        className="admin-novel-cover"
                        src={getPublicMediaUrl("covers", novel.cover_path)}
                        alt={novel.title}
                      />
                    ) : (
                      <div className="admin-novel-cover admin-novel-cover-empty">غلاف</div>
                    )}
                  </div>

                  <div className="admin-novel-info">
                    <h3>{novel.title}</h3>
                    <div className="novel-meta">
                      {(novel.novel_categories?.length || novel.categories?.name) && (
                        <span>
                          {(novel.novel_categories?.length
                            ? novel.novel_categories.map((item) => item.category.name)
                            : [novel.categories?.name]
                          ).filter(Boolean).join(" · ")}
                        </span>
                      )}
                      <span>{novel.status === "ongoing" ? "مستمرة" : "مكتملة"}</span>
                      <span className={novel.published ? "status-published" : "status-draft"}>
                        {novel.published ? "منشورة" : "مسودة"}
                      </span>
                    </div>
                  </div>

                  <div className="admin-row-actions">
                    <button className="secondary-button" onClick={() => openNovel(novel, true)}>الفصول</button>
                    <button className="secondary-button" onClick={() => editNovel(novel)}>تعديل</button>
                    <button className="secondary-button" onClick={() => toggleNovelPublished(novel)}>
                      {novel.published ? "إلغاء النشر" : "نشر"}
                    </button>
                    {isOwner && (
                      <button className="danger-button" onClick={() => deleteNovel(novel)}>حذف</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <AdsAdmin isOwner={isOwner} />
        )}

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
                  اختاري المستخدم الذي تريدين جعله مشرفًا
                </label>

                <select
                  value={selectedStaffUserId}
                  onChange={(event) =>
                    setSelectedStaffUserId(event.target.value)
                  }
                  disabled={managingStaff}
                >
                  <option value="">اختاري مستخدمًا...</option>
                  {availableStaffUsers
                    .filter((item) => item.role !== "staff")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.display_name || "بدون اسم") +
                          (item.email ? " — " + item.email : "")}
                      </option>
                    ))}
                </select>

                {availableStaffUsers.length === 0 && (
                  <small className="form-hint">
                    لا يوجد مستخدمون متاحون للاختيار حاليًا.
                  </small>
                )}
              </div>

              <button
                className="primary-button"
                onClick={addStaff}
                disabled={managingStaff || !selectedStaffUserId}
              >
                {managingStaff
                  ? "جارٍ التنفيذ..."
                  : "تعيين كمشرف"}
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

                <div className="profile-avatar-editor">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="صورة الحساب"
                      className="account-profile-avatar"
                    />
                  ) : (
                    <div className="account-profile-avatar account-profile-avatar-empty">👤</div>
                  )}

                  <div>
                    <strong>صورة الحساب</strong>
                    <p>اختاري صورة تظهر لك في القائمة الجانبية.</p>
                    <label className="profile-upload-button">
                      رفع صورة
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadProfileAvatar(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

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
                  <div className="novels-grid">
                    {favorites.map((favorite) => {
                      const novel =
                        publishedNovels.find(
                          (item) =>
                            item.id === favorite.novel_id
                        );

                      if (!novel) {
                        return null;
                      }

                      return renderNovelCard(novel);
                    })}
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

                  <div className="notification-heading-actions">
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => void dismissAllNotifications()}
                      >
                        تجاهل الإشعارات
                      </button>
                    )}

                    {unreadNotifications > 0 && (
                      <span className="count-badge">
                        {unreadNotifications}
                      </span>
                    )}
                  </div>
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

      {loginToast && (
        <div className="site-toast" role="status" aria-live="polite">
          <span className="site-toast-icon">✓</span>
          <span>{loginToast}</span>
        </div>
      )}

      {logoutToast && (
        <div className="site-toast site-toast-logout" role="status" aria-live="polite">
          <span className="site-toast-icon">✓</span>
          <span>{logoutToast}</span>
        </div>
      )}

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
      {!user && showAccount && (selectedChapter || selectedNovel) && (
        <div className="chapter-auth-modal" role="dialog" aria-modal="true" aria-label="تسجيل الدخول أو إنشاء حساب">
          <button
            type="button"
            className="chapter-auth-backdrop"
            aria-label="إغلاق التسجيل"
            onClick={() => setShowAccount(false)}
          />
          <div className="chapter-auth-dialog">
            <button
              type="button"
              className="chapter-auth-close"
              onClick={() => setShowAccount(false)}
              aria-label="إغلاق"
              title="إغلاق"
            >
              ×
            </button>
            {renderAuthPanel()}
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="confirm-dialog-backdrop" role="presentation">
          <div className="confirm-dialog" role="alertdialog" aria-modal="true">
            <p>{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="confirm-delete-button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await action();
                }}
              >
                حذف
              </button>
              <button
                type="button"
                className="confirm-cancel-button"
                onClick={() => setConfirmDialog(null)}
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

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
