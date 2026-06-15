import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Smal pre-launch-banner högst upp på sidan.
 * Sätter kontext direkt: vi är i pre-launch, anmäl intresse.
 * Ingen tidssättning — visas tills vi tar bort den inför lansering.
 */
export function AnnouncementBar() {
  return (
    <div className="fixed top-0 inset-x-0 z-50 w-full bg-primary/10 border-b border-primary/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-9 flex items-center justify-center gap-3">
        <span className="text-[12px] text-white/75 leading-none">
          Mailmind är i pre-launch — anmäl er nu och säkra prioriterad demo och onboarding vid lansering.
        </span>
        <Link
          href="/loi"
          className="group inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-cyan-300 transition-colors shrink-0"
        >
          Säkra er plats
          <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
