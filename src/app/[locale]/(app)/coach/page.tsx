import { getTranslations, setRequestLocale } from "next-intl/server";

import { APP_NAME, APP_TIMEZONE, COACH_NAME } from "@/config/app";
import { todayIso } from "@/domain/dates";
import { isCoachQuestion, suggestedQuestions } from "@/domain/coach-questions";
import { CoachAvatar } from "@/features/coach/coach-avatar";
import { CoachChat } from "@/features/coach/coach-chat";
import { CoachStyleForm } from "@/features/coach/coach-style-form";
import { WeeklyReviewLoader } from "@/features/coach/weekly-review-loader";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { lastWeekReview, listCoachMessages } from "@/server/coach";
import { getProfile } from "@/server/profile";
import { requireUser } from "@/server/session";
import { Card } from "@/ui/card";

export default async function CoachPage({ params, searchParams }: PageProps<"/[locale]/coach">) {
  const locale = toLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const profile = await getProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  const [review, messages] = await Promise.all([lastWeekReview(user.id), listCoachMessages(user.id)]);
  const t = await getTranslations("coach");
  const ask = (await searchParams).ask;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()),
  );
  const questions = suggestedQuestions(hour, `${user.id}:${todayIso()}`, 4);

  return (
    <>
      <header className="flex items-center gap-4">
        <CoachAvatar size={64} />
        <div className="flex flex-col">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{COACH_NAME}</h1>
          <p className="font-semibold text-text-muted">{t("subtitle")}</p>
        </div>
      </header>
      <p className="text-text-muted">{t("intro")}</p>

      <Card aria-labelledby="review-title">
        <h2 id="review-title" className="text-xl font-semibold">
          {t("reviewTitle")}
        </h2>
        {review ? (
          <>
            <p>{review.content.summary}</p>
            {review.content.highlights.length > 0 && (
              <>
                <h3 className="font-semibold">{t("highlights")}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-6">
                  {review.content.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {review.content.ideas.length > 0 && (
              <>
                <h3 className="font-semibold">{t("ideas")}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-6">
                  {review.content.ideas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <WeeklyReviewLoader />
        )}
      </Card>

      <Card aria-labelledby="chat-title">
        <h2 id="chat-title" className="text-xl font-semibold">
          {t("chatTitle")}
        </h2>
        <CoachChat
          messages={messages.map(({ id, role, content, notice }) => ({ id, role, content, notice }))}
          coachName={COACH_NAME}
          questions={questions}
          ask={isCoachQuestion(ask) ? ask : null}
        />
      </Card>

      <Card aria-labelledby="style-title">
        <h2 id="style-title" className="text-xl font-semibold">
          {t("styleTitle")}
        </h2>
        <CoachStyleForm style={profile.coachStyle} />
      </Card>

      <p className="text-sm text-text-muted">{t("disclaimer", { appName: APP_NAME })}</p>
    </>
  );
}
