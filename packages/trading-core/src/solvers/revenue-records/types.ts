/**
 * One normalized revenue record from the Enigma solver's `/revenue/records`
 * endpoint. Records are incremental: page through them with the `id` of the
 * last record seen (see {@link GetRevenueRecordsReturnType.count}).
 */
export interface SolverRevenueRecord {
  /** Monotonic record id, used as the cursor for incremental fetches. */
  id: number;
  /** Market symbol id this revenue record belongs to. */
  symbolId: number;
  /** Revenue amount as a decimal string, exactly as the solver reports it. */
  amount: string;
  /** Raw solver timestamp string for when the record was created. */
  createdAt: string;
}

/** Return type of the revenue-records read: the page of records plus the total count. */
export interface GetRevenueRecordsReturnType {
  /** The page of normalized revenue records. */
  records: SolverRevenueRecord[];
  /**
   * Total number of records available. Use with cursor pagination: pass the
   * `id` of the last record seen to fetch the next page.
   */
  count: number;
}
