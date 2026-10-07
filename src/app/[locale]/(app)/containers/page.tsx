import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContainerForm, RemoveButton } from "@/features/ai/personal-forms";
import { toLocale } from "@/i18n/routing";
import { listContainers } from "@/server/personal";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";
import { Columns } from "@/ui/columns";

export default async function ContainersPage({ params }: PageProps<"/[locale]/containers">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const containers = await listContainers(user.id);
  const t = await getTranslations("personal");

  return (
    <Columns>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("containersTitle")}</h1>
      <p className="text-text-muted">{t("containersIntro")}</p>
      <Card>
        {containers.length === 0 ? (
          <p className="text-text-muted">{t("noContainers")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {containers.map((container) => (
              <li key={container.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{container.name}</span>
                  <span className="text-sm text-text-muted">
                    {[
                      t(`kinds.${container.kind}`),
                      container.volumeMl && t("volumeValue", { ml: container.volumeMl }),
                      container.diameterCm && t("diameterValue", { cm: container.diameterCm }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <RemoveButton kind="container" id={container.id} name={container.name} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <ContainerForm />
      </Card>
    </Columns>
  );
}
