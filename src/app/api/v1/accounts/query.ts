/** Parses repeated/comma-separated search params into the account page query shape. */
export function accountQueryFromParams(params: URLSearchParams) {
  const list = (key: string) => {
    const values = params.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
    return values.length ? values : undefined;
  };
  return {
    q: params.get("q") ?? undefined,
    lifecycle: list("lifecycle"),
    segment: list("segment"),
    band: list("band"),
    ownerId: list("owner"),
    sort: params.get("sort") ?? undefined,
    direction: params.get("dir") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  };
}
