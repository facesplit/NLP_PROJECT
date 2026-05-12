import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/media";
import { api, ApiError } from "@/api";

interface Props {
  /** Stored image path (e.g. "uploads/abc.jpg" or absolute URL). */
  value: string | null;
  onChange: (path: string | null) => void;
  aspect?: "square" | "wide";
  hint?: string;
}

const MAX_SIZE = 5 * 1024 * 1024;

export function ImageUpload({ value, onChange, aspect = "square", hint }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("image_upload.only_images"));
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("image_upload.too_large"));
      return;
    }
    setBusy(true);
    try {
      const path = await api.uploads.upload(file);
      onChange(path);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("image_upload.failed_default");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const previewUrl = value ? mediaUrl(value) ?? value : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-dashed border-border bg-cream/40 transition-colors hover:border-rose/40",
        aspect === "wide" ? "aspect-[16/7]" : "aspect-square",
      )}
    >
      {previewUrl ? (
        <>
          <img src={previewUrl} alt={t("image_upload.alt")} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-foreground shadow hover:bg-card"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-muted-foreground"
        >
          <ImageIcon className="h-8 w-8 text-rose/70" />
          <span className="text-sm">{busy ? t("image_upload.uploading") : t("image_upload.click_to_pick")}</span>
          {hint && <span className="text-xs">{hint}</span>}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {previewUrl && (
        <div className="absolute bottom-2 left-2">
          <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()}>
            <Upload className="h-3 w-3" /> {t("image_upload.replace")}
          </Button>
        </div>
      )}
    </div>
  );
}
