export type InventoryItem = {
  sku: string;   // matches nwcs_catalog.sku
  name: string;  // matches nwcs_catalog.name
  on_hand: number;
};

export class CulteveraLoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CulteveraLoginError";
  }
}

export class CulteveraScrapeError extends Error {
  constructor(
    message: string,
    public url?: string,
  ) {
    super(message);
    this.name = "CulteveraScrapeError";
  }
}
