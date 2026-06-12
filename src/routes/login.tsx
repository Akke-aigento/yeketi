import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Klantenportaal — Yeketi Motorworks" },
      { name: "description", content: "Beveiligd klantenportaal voor lopende restauraties." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 flex items-center">
        <section className="container-edit text-center" style={{ paddingBlock: "clamp(4rem,10vw,8rem)" }}>
          <ScrollReveal>
            <p className="eyebrow">Binnenkort</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2rem,4.5vw,3.4rem)" }}>{t.login.title}</h1>
            <p className="mt-6 mx-auto max-w-xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              {t.login.body}
            </p>
            <div className="mt-10">
              <Link to="/" className="btn-y">{t.login.back}</Link>
            </div>
          </ScrollReveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}