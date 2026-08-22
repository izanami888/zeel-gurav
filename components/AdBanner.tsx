"use client";

import { useEffect, useState } from "react";
import { fetchActiveAd, recordAdClick, recordAdImpression, type Ad } from "@/lib/ads";

// TODO(admin): Ирээдүйд энэ компонентыг /admin/ads хуудаснаас удирдах
// боломжтой болгоно (зар нэмэх, идэвхжүүлэх, статистик харах гэх мэт).
// Одоохондоо Supabase-ийн ads хүснэгтээс шууд уншиж, олдоогүй бол
// доорх house ad-г (сурталчилгааны сул зай) харуулна.

interface AdBannerProps {
  placement: Ad["placement"];
  className?: string;
}

export default function AdBanner({ placement, className = "" }: AdBannerProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchActiveAd(placement).then((result) => {
      if (cancelled) return;
      setAd(result);
      setLoaded(true);
      if (result) recordAdImpression(result.id);
    });

    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!loaded) {
    return (
      <div
        className={`h-24 w-full animate-pulse rounded-xl bg-mongol-blue-light/40 ${className}`}
      />
    );
  }

  if (!ad) {
    // House ad / placeholder — жинхэнэ захиалагч зар байхгүй үед харагдана.
    return (
      <div
        className={`flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-mongol-gold/40 bg-mongol-blue-light/30 text-sm text-mongol-gold-light/70 ${className}`}
      >
        Таны компанийн зар энд байршиж болно — холбогдоно уу
      </div>
    );
  }

  return (
    <a
      href={ad.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => recordAdClick(ad.id)}
      className={`block w-full overflow-hidden rounded-xl border border-mongol-gold/20 bg-mongol-blue-light/30 transition hover:border-mongol-gold/50 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.image_url}
        alt={ad.company_name}
        className="h-24 w-full object-cover"
      />
    </a>
  );
}
