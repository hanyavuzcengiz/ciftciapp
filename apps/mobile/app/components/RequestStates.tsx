import { StateCard } from "./states/StateCard";
import { StateNotice } from "./states/StateNotice";
import { StateSkeleton } from "./states/StateSkeleton";

export { StateCard, StateNotice, StateSkeleton };

/** Backward-compat alias; yeni kodda StateCard kullanin. */
export function TryAgainState(props: { title: string; description: string; onRetry?: () => void }) {
  return (
    <StateCard
      title={props.title}
      description={props.description}
      actionLabel={props.onRetry ? "Tekrar dene" : undefined}
      onAction={props.onRetry}
    />
  );
}

/** Backward-compat aliases */
export const InlineNotice = StateNotice;
export const EmptyState = StateCard;
export const SkeletonList = StateSkeleton;
