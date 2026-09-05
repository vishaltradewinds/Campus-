import { doc, runTransaction, type DocumentReference, type Firestore } from 'firebase/firestore';

/**
 * Atomically create a requirement and its campaign. Both documents are created
 * together so a published recruitment campaign can never point at a missing
 * requirement. The caller must supply already-authorized employer-owned data.
 */
export async function createRequirementAndCampaignAtomically<TRequirement, TCampaign>(
  firestore: Firestore,
  requirementId: string,
  requirement: TRequirement,
  campaignId: string,
  campaign: TCampaign,
): Promise<void> {
  const requirementRef = doc(firestore, 'requirements', requirementId);
  const campaignRef = doc(firestore, 'campaigns', campaignId);

  await runTransaction(firestore, async transaction => {
    const [requirementSnap, campaignSnap] = await Promise.all([
      transaction.get(requirementRef),
      transaction.get(campaignRef),
    ]);

    if (requirementSnap.exists() || campaignSnap.exists()) {
      throw new Error('Recruitment identifiers already exist; refusing to overwrite.');
    }

    transaction.set(requirementRef, requirement);
    transaction.set(campaignRef, campaign);
  });
}

/**
 * Atomically update a campaign and one or more employer-owned call documents.
 * This primitive intentionally performs no UI state mutation; Firestore may
 * retry a transaction under contention.
 */
export async function commitEmployerCallBatch<TCampaign, TCall>(
  firestore: Firestore,
  campaignId: string,
  campaign: TCampaign,
  calls: Array<{ id: string; data: TCall }>,
): Promise<void> {
  const campaignRef = doc(firestore, 'campaigns', campaignId);
  const callRefs: Array<{ ref: DocumentReference; data: TCall }> = calls.map(call => ({
    ref: doc(firestore, 'calls', call.id),
    data: call.data,
  }));

  await runTransaction(firestore, async transaction => {
    const campaignSnap = await transaction.get(campaignRef);
    if (!campaignSnap.exists()) throw new Error('Campaign no longer exists.');

    const callSnapshots = await Promise.all(callRefs.map(({ ref }) => transaction.get(ref)));
    if (callSnapshots.some(snapshot => snapshot.exists())) {
      throw new Error('One or more call identifiers already exist; refusing to duplicate recruitment calls.');
    }

    for (const { ref, data } of callRefs) transaction.set(ref, data);
    transaction.set(campaignRef, campaign);
  });
}

/**
 * Replay-safe counter transition. A response may be retried without inflating
 * institutionsAccepted because the counter changes only on a pending ->
 * accepted transition.
 */
export function acceptedInstitutionDelta(previousStatus: string | undefined, nextStatus: string): number {
  const wasAccepted = previousStatus !== undefined && previousStatus !== 'pending' && previousStatus !== 'declined';
  const isAccepted = nextStatus !== 'pending' && nextStatus !== 'declined';
  return Number(isAccepted) - Number(wasAccepted);
}
