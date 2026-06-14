import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { t } from "@/lib/copy";
import beforeImg from "@/assets/vw-t2-before.jpg";
import afterImg from "@/assets/vw-t2-after.jpg";
import arrivalImg from "@/assets/oldtimer-arrival.jpg";
import handsImg from "@/assets/craftsman-hands.jpg";
import interiorImg from "@/assets/oldtimer-interior.jpg";
import deliveryImg from "@/assets/oldtimer-delivery.jpg";
import workshopImg from "@/assets/hero-workshop.jpg";
import teamImg from "@/assets/workshop-team.jpg";

export const Route = createFileRoute("/recent-werk")({
  head: () => ({
    meta: [
      { title: "Recent werk · Yeketi Motorworks" },
      { name: "description", content: "Een visueel overzicht van recente restauraties — de beelden spreken voor zich." },
      { property: "og:title", content: "Recent werk · Yeketi Motorworks" },
      { property: "og:description", content: "Een visueel overzicht van recente restauraties." },
      { property: "og:url", content: "https://yeketimotorworks.com/recent-werk" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/recent-werk" }],
  }),
  component: RecentWerk,
});

type Shot = { src: string; alt: string; ratio: string };

const shots: Shot[] = [
  { src: arrivalImg, alt: "Aankomst van een klassieker in de werkplaats", ratio: "4/3" },
  { src: handsImg, alt: "Handen van een meester-ambachtsman", ratio: "4/5" },
  { src: beforeImg, alt: "VW T2 — voor de restauratie", ratio: "4/3" },
  { src: workshopImg, alt: "Werkplaats in Erbil", ratio: "4/3" },
  { src: afterImg, alt: "VW T2 — na de restauratie", ratio: "4/3" },
  { src: interiorImg, alt: "Gerestaureerd interieur van een oldtimer", ratio: "4/3" },
  { src: teamImg, alt: "Het team in de werkplaats", ratio: "4/3" },
  { src: deliveryImg, alt: "Spik en span gerestaureerde oldtimer bij aflevering", ratio: "4/3" },
];

function RecentWerk() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section style={{ paddingBlock: "clamp(3rem,7vw,6rem)" }}>
          <div className="container-edit">
            <ScrollReveal>
              <p className="eyebrow">{t.recent.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl" style={{ fontSize: "clamp(2rem,4.4vw,3.6rem)" }}>
                Recent werk.
              </h1>
              <p className="mt-5 max-w-xl italic-quote" style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem" }}>
                De beelden spreken voor zich.
              </p>
            </ScrollReveal>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {shots.map((s, i) => (
                <ScrollReveal key={s.src} delay={(i % 3) * 80}>
                  <figure style={{ border: "1px solid var(--charcoal)" }}>
                    <img
                      src={s.src}
                      alt={s.alt}
                      loading="lazy"
                      className="w-full block"
                      style={{ objectFit: "cover", aspectRatio: s.ratio }}
                    />
                  </figure>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}