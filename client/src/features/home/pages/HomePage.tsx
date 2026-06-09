import { Hero } from "../components/hero";
import { DirectorMessage } from "../components/director-message";
import { FeaturesSection } from "../components/features-section";
import { StatsSection } from "../components/stats-section";
import { NewsTicker } from "../components/news-ticker";
import { WaveDivider } from "../components/wave-divider";

export function HomePage() {
  return (
    <>
      <Hero />
      <NewsTicker />
      <WaveDivider />
      <DirectorMessage />
      <FeaturesSection />
      <StatsSection />
    </>
  );
}
