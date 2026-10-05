export class VoidPolicy {
  public static canVoid(status: string, hasVoidPermission: boolean): boolean {
    if (!hasVoidPermission) {
      return false;
    }
    return status === "completed" || status === "partial_return";
  }

  public static requireReason(reason: string): boolean {
    return reason.trim().length > 0;
  }
}

export class ReturnPolicy {
  public static canReturn(
    status: string,
    hasReturnPermission: boolean
  ): boolean {
    if (!hasReturnPermission) {
      return false;
    }
    return status === "completed" || status === "partial_return";
  }

  public static maxReturnableQty(
    soldQty: number,
    alreadyReturnedQty: number
  ): number {
    return Math.max(soldQty - alreadyReturnedQty, 0);
  }

  public static isValidReturnQty(
    soldQty: number,
    alreadyReturnedQty: number,
    requestedQty: number
  ): boolean {
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      return false;
    }
    return (
      requestedQty <= ReturnPolicy.maxReturnableQty(soldQty, alreadyReturnedQty)
    );
  }

  public static proportionalRefund(
    itemSubtotal: number,
    itemQty: number,
    returnQty: number
  ): number {
    if (itemQty <= 0) {
      return 0;
    }
    return Math.round((itemSubtotal / itemQty) * returnQty);
  }
}
