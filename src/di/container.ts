import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server-client";
import { createSupabaseAdminClient } from "@/shared/infrastructure/supabase/admin-client";

// Sales module dependencies
import { SupabaseSaleRepository } from "@/modules/sales/infrastructure/supabase-sale.repository";
import {
  CheckoutUseCase,
  GetSaleReceiptUseCase,
} from "@/modules/sales/application/use-cases/checkout.use-case";
import {
  CreateReturnUseCase,
  ListReturnsUseCase,
  VoidSaleUseCase,
} from "@/modules/sales/application/use-cases/void-return.use-cases";
import {
  HoldSaleUseCase,
  ListHeldSalesUseCase,
  ResumeSaleUseCase,
} from "@/modules/sales/application/use-cases/hold.use-cases";
import { SearchProductsForPOSUseCase } from "@/modules/sales/application/use-cases/search-products-pos.use-case";

// IAM module dependencies
import { SupabaseUserRepository } from "@/modules/iam/infrastructure/supabase-user.repository";
import { SupabaseRoleRepository } from "@/modules/iam/infrastructure/supabase-role.repository";
import { SupabaseAuthService } from "@/modules/iam/infrastructure/supabase-auth.service";
import { LoginUseCase } from "@/modules/iam/application/use-cases/login.use-case";
import { GetCurrentUserUseCase } from "@/modules/iam/application/use-cases/get-current-user.use-case";
import { ListUsersUseCase } from "@/modules/iam/application/use-cases/list-users.use-case";
import { ListRolesUseCase } from "@/modules/iam/application/use-cases/list-roles.use-case";
import { CreateUserUseCase } from "@/modules/iam/application/use-cases/create-user.use-case";
import { UpdateUserUseCase } from "@/modules/iam/application/use-cases/update-user.use-case";
import {
  ListPinUsersUseCase,
  LoginWithPinUseCase,
  SetPinUseCase,
} from "@/modules/iam/application/use-cases/pin.use-cases";
import {
  CreateRoleUseCase,
  DeleteRoleUseCase,
  ListPermissionsUseCase,
  UpdateRoleUseCase,
} from "@/modules/iam/application/use-cases/role.use-cases";

// Catalog module dependencies
import { SupabasePriceTierRepository } from "@/modules/catalog/infrastructure/supabase-price-tier.repository";
import { SupabaseProductRepository } from "@/modules/catalog/infrastructure/supabase-product.repository";
import { SupabaseBundleRepository } from "@/modules/catalog/infrastructure/supabase-bundle.repository";
import {
  SupabaseBrandRepository,
  SupabaseCategoryRepository,
  SupabaseUnitRepository,
} from "@/modules/catalog/infrastructure/supabase-master-data.repository";
import { CreateProductUseCase } from "@/modules/catalog/application/use-cases/create-product.use-case";
import {
  GetBundleItemsUseCase,
  SaveBundleItemsUseCase,
} from "@/modules/catalog/application/use-cases/bundle.use-cases";
import {
  ImportProductsUseCase,
  PreviewProductImportUseCase,
} from "@/modules/catalog/application/use-cases/product-import.use-cases";
import {
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  SearchProductsUseCase,
  UpdateProductUseCase,
} from "@/modules/catalog/application/use-cases/product.use-cases";
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from "@/modules/catalog/application/use-cases/category.use-cases";
import {
  GetPriceTiersUseCase,
  SetPriceTiersUseCase,
} from "@/modules/catalog/application/use-cases/price-tier.use-cases";
import {
  CreateBrandUseCase,
  CreateUnitUseCase,
  DeleteBrandUseCase,
  DeleteUnitUseCase,
  ListBrandsUseCase,
  ListUnitsUseCase,
  UpdateBrandUseCase,
  UpdateUnitUseCase,
} from "@/modules/catalog/application/use-cases/master-data.use-cases";

// Inventory module dependencies
import {
  SupabaseStockRepository,
  SupabaseStockMovementRepository,
} from "@/modules/inventory/infrastructure/supabase-stock.repository";
import {
  GetLowStockCountUseCase,
  GetLowStockItemsUseCase,
  GetStockCardUseCase,
  GetStockUseCase,
  ListStockOverviewUseCase,
  RecordStockMovementUseCase,
} from "@/modules/inventory/application/use-cases/stock.use-cases";
import {
  GetExpiringBatchesUseCase,
  GetExpiringCountUseCase,
} from "@/modules/inventory/application/use-cases/expiry.use-cases";
import {
  AdjustStockUseCase,
  ApproveOpnameUseCase,
  CreateOpnameUseCase,
  GetOpnameDetailUseCase,
  ListOpnamesUseCase,
  UpdateOpnameItemUseCase,
} from "@/modules/inventory/application/use-cases/opname.use-cases";
import { SupabaseStockOpnameRepository } from "@/modules/inventory/infrastructure/supabase-stock-opname.repository";

// Settings module dependencies
import { SupabaseAuditRepository } from "@/modules/settings/infrastructure/supabase-audit.repository";
import {
  ListAuditActionsUseCase,
  ListAuditLogsUseCase,
} from "@/modules/settings/application/use-cases/audit.use-cases";
import { SupabasePaymentMethodRepository } from "@/modules/settings/infrastructure/supabase-payment-method.repository";
import { SupabaseSettingsRepository } from "@/modules/settings/infrastructure/supabase-settings.repository";
import {
  ListActivePaymentMethodsUseCase,
  ListPaymentMethodsUseCase,
} from "@/modules/settings/application/use-cases/list-active-payment-methods.use-case";
import {
  GetStoreSettingsUseCase,
  UpdateStoreSettingsUseCase,
} from "@/modules/settings/application/use-cases/store-settings.use-cases";
import {
  CreatePaymentMethodUseCase,
  UpdatePaymentMethodUseCase,
} from "@/modules/settings/application/use-cases/payment-method.use-cases";
import {
  GetPricingSettingsUseCase,
  UpdatePricingSettingsUseCase,
} from "@/modules/settings/application/use-cases/pricing-settings.use-cases";
import {
  GetLoyaltySettingsUseCase,
  UpdateLoyaltySettingsUseCase,
} from "@/modules/settings/application/use-cases/loyalty-settings.use-cases";
import {
  GetInventorySettingsUseCase,
  UpdateInventorySettingsUseCase,
} from "@/modules/settings/application/use-cases/inventory-settings.use-cases";

// Reporting module dependencies
import { SupabaseSalesReportRepository } from "@/modules/reporting/infrastructure/supabase-sales-report.repository";
import { SupabaseAdvancedReportRepository } from "@/modules/reporting/infrastructure/supabase-advanced-report.repository";
import {
  GetSalesReportUseCase,
  GetRecentTransactionsUseCase,
} from "@/modules/reporting/application/use-cases/get-sales-report.use-case";
import {
  GetPeriodProfitUseCase,
  GetProductProfitUseCase,
} from "@/modules/reporting/application/use-cases/advanced-report.use-cases";
import {
  GetOperationalReportUseCase,
  GetStockValuationUseCase,
} from "@/modules/reporting/application/use-cases/operational-report.use-cases";

// Customers module dependencies
import { SupabaseCustomerRepository } from "@/modules/customers/infrastructure/supabase-customer.repository";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerHistoryUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  SearchCustomersUseCase,
  UpdateCustomerUseCase,
} from "@/modules/customers/application/use-cases/customer.use-cases";
import { SupabaseLoyaltyRepository } from "@/modules/customers/infrastructure/supabase-loyalty.repository";
import {
  AdjustPointsUseCase,
  EarnPointsUseCase,
  GetLoyaltyHistoryUseCase,
  RedeemPointsUseCase,
} from "@/modules/customers/application/use-cases/loyalty.use-cases";

// Purchasing module dependencies
import { SupabaseSupplierRepository } from "@/modules/purchasing/infrastructure/supabase-supplier.repository";
import { SupabasePurchaseOrderRepository } from "@/modules/purchasing/infrastructure/supabase-purchase-order.repository";
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  ListSuppliersUseCase,
  UpdateSupplierUseCase,
} from "@/modules/purchasing/application/use-cases/supplier.use-cases";
import {
  CancelPOUseCase,
  CreatePOUseCase,
  CreatePurchaseReturnUseCase,
  GetPOUseCase,
  ListPOsUseCase,
  ListPurchaseReturnsUseCase,
  ListReceiptsUseCase,
  ReceiveGoodsUseCase,
  SendPOUseCase,
  UpdatePOUseCase,
} from "@/modules/purchasing/application/use-cases/purchase-order.use-cases";

import { SupabaseSupplierDebtRepository } from "@/modules/purchasing/infrastructure/supabase-supplier-debt.repository";
import {
  ListSupplierDebtsUseCase,
  RecordSupplierPaymentUseCase,
} from "@/modules/purchasing/application/use-cases/supplier-debt.use-cases";
import { SupabaseReceivableRepository } from "@/modules/customers/infrastructure/supabase-receivable.repository";
import {
  ListReceivablesUseCase,
  RecordReceivablePaymentUseCase,
} from "@/modules/customers/application/use-cases/receivable.use-cases";

// Promotions module dependencies
import {
  SupabasePromotionRepository,
  SupabaseVoucherRepository,
} from "@/modules/promotions/infrastructure/supabase-promotion.repository";
import {
  CreatePromotionUseCase,
  CreateVoucherUseCase,
  GetActivePromotionsUseCase,
  ListPromotionsUseCase,
  ListVouchersUseCase,
  TogglePromotionUseCase,
  ToggleVoucherUseCase,
  UpdatePromotionUseCase,
  ValidateVoucherUseCase,
} from "@/modules/promotions/application/use-cases/promotion.use-cases";

// Shifts module dependencies
import { SupabaseShiftRepository } from "@/modules/shifts/infrastructure/supabase-shift.repository";
import {
  AddCashMovementUseCase,
  CloseShiftUseCase,
  GetCurrentShiftUseCase,
  GetShiftSummaryUseCase,
  ListShiftsUseCase,
  OpenShiftUseCase,
} from "@/modules/shifts/application/use-cases/shift.use-cases";

// Finance module dependencies
import {
  SupabaseExpenseCategoryRepository,
  SupabaseExpenseRepository,
} from "@/modules/finance/infrastructure/supabase-expense.repository";
import { SupabaseFinanceReportRepository } from "@/modules/finance/infrastructure/supabase-finance-report.repository";
import {
  CreateExpenseCategoryUseCase,
  DeleteExpenseCategoryUseCase,
  DeleteExpenseUseCase,
  ListExpenseCategoriesUseCase,
  ListExpensesUseCase,
  RecordExpenseUseCase,
  UpdateExpenseCategoryUseCase,
  UpdateExpenseUseCase,
} from "@/modules/finance/application/use-cases/expense.use-cases";
import {
  GetCashFlowUseCase,
  GetProfitLossUseCase,
  GetProfitTrendUseCase,
} from "@/modules/finance/application/use-cases/finance-report.use-cases";

export interface AppContainer {
  sales: {
    checkout: CheckoutUseCase;
    getSaleReceipt: GetSaleReceiptUseCase;
    searchProductsForPOS: SearchProductsForPOSUseCase;
    voidSale: VoidSaleUseCase;
    createReturn: CreateReturnUseCase;
    listReturns: ListReturnsUseCase;
    holdSale: HoldSaleUseCase;
    listHeldSales: ListHeldSalesUseCase;
    resumeSale: ResumeSaleUseCase;
  };
  iam: {
    login: LoginUseCase;
    getCurrentUser: GetCurrentUserUseCase;
    listUsers: ListUsersUseCase;
    listRoles: ListRolesUseCase;
    createUser: CreateUserUseCase;
    updateUser: UpdateUserUseCase;
    setPin: SetPinUseCase;
    loginWithPin: LoginWithPinUseCase;
    listPinUsers: ListPinUsersUseCase;
    createRole: CreateRoleUseCase;
    updateRole: UpdateRoleUseCase;
    deleteRole: DeleteRoleUseCase;
    listPermissions: ListPermissionsUseCase;
  };
  catalog: {
    createProduct: CreateProductUseCase;
    updateProduct: UpdateProductUseCase;
    deleteProduct: DeleteProductUseCase;
    getProduct: GetProductUseCase;
    listProducts: ListProductsUseCase;
    searchProducts: SearchProductsUseCase;
    listCategories: ListCategoriesUseCase;
    createCategory: CreateCategoryUseCase;
    updateCategory: UpdateCategoryUseCase;
    deleteCategory: DeleteCategoryUseCase;
    listBrands: ListBrandsUseCase;
    createBrand: CreateBrandUseCase;
    updateBrand: UpdateBrandUseCase;
    deleteBrand: DeleteBrandUseCase;
    listUnits: ListUnitsUseCase;
    createUnit: CreateUnitUseCase;
    updateUnit: UpdateUnitUseCase;
    deleteUnit: DeleteUnitUseCase;
    getPriceTiers: GetPriceTiersUseCase;
    setPriceTiers: SetPriceTiersUseCase;
    getBundleItems: GetBundleItemsUseCase;
    saveBundleItems: SaveBundleItemsUseCase;
    previewProductImport: PreviewProductImportUseCase;
    importProducts: ImportProductsUseCase;
  };
  inventory: {
    getStock: GetStockUseCase;
    listStockOverview: ListStockOverviewUseCase;
    getStockCard: GetStockCardUseCase;
    recordStockMovement: RecordStockMovementUseCase;
    getLowStockCount: GetLowStockCountUseCase;
    getLowStockItems: GetLowStockItemsUseCase;
    getExpiringCount: GetExpiringCountUseCase;
    getExpiringBatches: GetExpiringBatchesUseCase;
    adjustStock: AdjustStockUseCase;
    createOpname: CreateOpnameUseCase;
    updateOpnameItem: UpdateOpnameItemUseCase;
    approveOpname: ApproveOpnameUseCase;
    listOpnames: ListOpnamesUseCase;
    getOpnameDetail: GetOpnameDetailUseCase;
  };
  settings: {
    listActivePaymentMethods: ListActivePaymentMethodsUseCase;
    listPaymentMethods: ListPaymentMethodsUseCase;
    getStoreSettings: GetStoreSettingsUseCase;
    updateStoreSettings: UpdateStoreSettingsUseCase;
    createPaymentMethod: CreatePaymentMethodUseCase;
    updatePaymentMethod: UpdatePaymentMethodUseCase;
    getPricingSettings: GetPricingSettingsUseCase;
    updatePricingSettings: UpdatePricingSettingsUseCase;
    getLoyaltySettings: GetLoyaltySettingsUseCase;
    updateLoyaltySettings: UpdateLoyaltySettingsUseCase;
    getInventorySettings: GetInventorySettingsUseCase;
    updateInventorySettings: UpdateInventorySettingsUseCase;
    listAuditLogs: ListAuditLogsUseCase;
    listAuditActions: ListAuditActionsUseCase;
  };
  reporting: {
    getSalesReport: GetSalesReportUseCase;
    getRecentTransactions: GetRecentTransactionsUseCase;
    getOperationalReport: GetOperationalReportUseCase;
    getStockValuation: GetStockValuationUseCase;
    getProductProfit: GetProductProfitUseCase;
    getPeriodProfit: GetPeriodProfitUseCase;
  };
  customers: {
    createCustomer: CreateCustomerUseCase;
    updateCustomer: UpdateCustomerUseCase;
    deleteCustomer: DeleteCustomerUseCase;
    getCustomer: GetCustomerUseCase;
    listCustomers: ListCustomersUseCase;
    searchCustomers: SearchCustomersUseCase;
    getCustomerHistory: GetCustomerHistoryUseCase;
    listReceivables: ListReceivablesUseCase;
    recordReceivablePayment: RecordReceivablePaymentUseCase;
    earnPoints: EarnPointsUseCase;
    redeemPoints: RedeemPointsUseCase;
    adjustPoints: AdjustPointsUseCase;
    getLoyaltyHistory: GetLoyaltyHistoryUseCase;
  };
  purchasing: {
    listSuppliers: ListSuppliersUseCase;
    createSupplier: CreateSupplierUseCase;
    updateSupplier: UpdateSupplierUseCase;
    deleteSupplier: DeleteSupplierUseCase;
    listPOs: ListPOsUseCase;
    getPO: GetPOUseCase;
    listReceipts: ListReceiptsUseCase;
    listPurchaseReturns: ListPurchaseReturnsUseCase;
    listSupplierDebts: ListSupplierDebtsUseCase;
    recordSupplierPayment: RecordSupplierPaymentUseCase;
    createPO: CreatePOUseCase;
    updatePO: UpdatePOUseCase;
    sendPO: SendPOUseCase;
    cancelPO: CancelPOUseCase;
    receiveGoods: ReceiveGoodsUseCase;
    createPurchaseReturn: CreatePurchaseReturnUseCase;
  };
  promotions: {
    listPromotions: ListPromotionsUseCase;
    getActivePromotions: GetActivePromotionsUseCase;
    createPromotion: CreatePromotionUseCase;
    updatePromotion: UpdatePromotionUseCase;
    togglePromotion: TogglePromotionUseCase;
    listVouchers: ListVouchersUseCase;
    createVoucher: CreateVoucherUseCase;
    toggleVoucher: ToggleVoucherUseCase;
    validateVoucher: ValidateVoucherUseCase;
  };
  shifts: {
    openShift: OpenShiftUseCase;
    getCurrentShift: GetCurrentShiftUseCase;
    closeShift: CloseShiftUseCase;
    addCashMovement: AddCashMovementUseCase;
    getShiftSummary: GetShiftSummaryUseCase;
    listShifts: ListShiftsUseCase;
  };
  finance: {
    listExpenseCategories: ListExpenseCategoriesUseCase;
    createExpenseCategory: CreateExpenseCategoryUseCase;
    updateExpenseCategory: UpdateExpenseCategoryUseCase;
    deleteExpenseCategory: DeleteExpenseCategoryUseCase;
    recordExpense: RecordExpenseUseCase;
    listExpenses: ListExpensesUseCase;
    updateExpense: UpdateExpenseUseCase;
    deleteExpense: DeleteExpenseUseCase;
    getCashFlow: GetCashFlowUseCase;
    getProfitLoss: GetProfitLossUseCase;
    getProfitTrend: GetProfitTrendUseCase;
  };
}

/**
 * Creates the composition root container wiring repositories with use cases.
 */
export function createContainer(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>
): AppContainer {
  // 1. Repositories & services
  const saleRepository = new SupabaseSaleRepository(supabase);
  const userRepository = new SupabaseUserRepository(supabase, adminSupabase);
  const roleRepository = new SupabaseRoleRepository(supabase);
  const authService = new SupabaseAuthService(supabase, adminSupabase);

  // 2. Use Cases
  const productRepository = new SupabaseProductRepository(supabase);
  const bundleRepository = new SupabaseBundleRepository(supabase);
  const priceTierRepository = new SupabasePriceTierRepository(supabase);
  const categoryRepository = new SupabaseCategoryRepository(supabase);
  const brandRepository = new SupabaseBrandRepository(supabase);
  const unitRepository = new SupabaseUnitRepository(supabase);
  const stockRepository = new SupabaseStockRepository(supabase);
  const stockMovementRepository = new SupabaseStockMovementRepository(
    supabase,
    stockRepository
  );
  const stockOpnameRepository = new SupabaseStockOpnameRepository(supabase);
  const paymentMethodRepository = new SupabasePaymentMethodRepository(supabase);
  const settingsRepository = new SupabaseSettingsRepository(supabase);
  const salesReportRepository = new SupabaseSalesReportRepository(supabase);
  const advancedReportRepository = new SupabaseAdvancedReportRepository(
    supabase
  );
  const auditRepository = new SupabaseAuditRepository(supabase);
  const shiftRepository = new SupabaseShiftRepository(supabase);
  const promotionRepository = new SupabasePromotionRepository(supabase);
  const voucherRepository = new SupabaseVoucherRepository(supabase);
  const supplierRepository = new SupabaseSupplierRepository(supabase);
  const purchaseOrderRepository = new SupabasePurchaseOrderRepository(supabase);
  const customerRepository = new SupabaseCustomerRepository(supabase);
  const receivableRepository = new SupabaseReceivableRepository(supabase);
  const loyaltyRepository = new SupabaseLoyaltyRepository(supabase);
  const supplierDebtRepository = new SupabaseSupplierDebtRepository(supabase);
  const expenseRepository = new SupabaseExpenseRepository(supabase);
  const expenseCategoryRepository = new SupabaseExpenseCategoryRepository(
    supabase
  );
  const financeReportRepository = new SupabaseFinanceReportRepository(supabase);

  return {
    sales: {
      checkout: new CheckoutUseCase(
        saleRepository,
        productRepository,
        stockRepository,
        shiftRepository,
        priceTierRepository,
        settingsRepository,
        customerRepository,
        promotionRepository,
        voucherRepository
      ),
      getSaleReceipt: new GetSaleReceiptUseCase(saleRepository),
      searchProductsForPOS: new SearchProductsForPOSUseCase(
        productRepository,
        priceTierRepository
      ),
      voidSale: new VoidSaleUseCase(saleRepository),
      createReturn: new CreateReturnUseCase(saleRepository),
      listReturns: new ListReturnsUseCase(saleRepository),
      holdSale: new HoldSaleUseCase(saleRepository),
      listHeldSales: new ListHeldSalesUseCase(saleRepository),
      resumeSale: new ResumeSaleUseCase(saleRepository),
    },
    iam: {
      login: new LoginUseCase(userRepository, authService),
      getCurrentUser: new GetCurrentUserUseCase(userRepository, authService),
      listUsers: new ListUsersUseCase(userRepository),
      listRoles: new ListRolesUseCase(roleRepository),
      createUser: new CreateUserUseCase(userRepository, roleRepository),
      updateUser: new UpdateUserUseCase(userRepository, roleRepository),
      setPin: new SetPinUseCase(userRepository),
      loginWithPin: new LoginWithPinUseCase(
        new SupabaseUserRepository(adminSupabase, adminSupabase),
        authService
      ),
      listPinUsers: new ListPinUsersUseCase(authService),
      createRole: new CreateRoleUseCase(roleRepository),
      updateRole: new UpdateRoleUseCase(roleRepository),
      deleteRole: new DeleteRoleUseCase(roleRepository),
      listPermissions: new ListPermissionsUseCase(roleRepository),
    },
    catalog: {
      createProduct: new CreateProductUseCase(productRepository),
      updateProduct: new UpdateProductUseCase(productRepository),
      deleteProduct: new DeleteProductUseCase(productRepository),
      getProduct: new GetProductUseCase(productRepository),
      listProducts: new ListProductsUseCase(productRepository),
      searchProducts: new SearchProductsUseCase(productRepository),
      listCategories: new ListCategoriesUseCase(categoryRepository),
      createCategory: new CreateCategoryUseCase(categoryRepository),
      updateCategory: new UpdateCategoryUseCase(categoryRepository),
      deleteCategory: new DeleteCategoryUseCase(categoryRepository),
      listBrands: new ListBrandsUseCase(brandRepository),
      createBrand: new CreateBrandUseCase(brandRepository),
      updateBrand: new UpdateBrandUseCase(brandRepository),
      deleteBrand: new DeleteBrandUseCase(brandRepository),
      listUnits: new ListUnitsUseCase(unitRepository),
      createUnit: new CreateUnitUseCase(unitRepository),
      updateUnit: new UpdateUnitUseCase(unitRepository),
      deleteUnit: new DeleteUnitUseCase(unitRepository),
      getPriceTiers: new GetPriceTiersUseCase(priceTierRepository),
      setPriceTiers: new SetPriceTiersUseCase(
        priceTierRepository,
        productRepository
      ),
      getBundleItems: new GetBundleItemsUseCase(bundleRepository),
      saveBundleItems: new SaveBundleItemsUseCase(bundleRepository),
      previewProductImport: new PreviewProductImportUseCase(
        productRepository,
        categoryRepository,
        brandRepository,
        unitRepository
      ),
      importProducts: new ImportProductsUseCase(
        productRepository,
        categoryRepository,
        brandRepository,
        unitRepository
      ),
    },
    inventory: {
      getStock: new GetStockUseCase(stockRepository),
      listStockOverview: new ListStockOverviewUseCase(stockRepository),
      getStockCard: new GetStockCardUseCase(
        stockRepository,
        stockMovementRepository
      ),
      recordStockMovement: new RecordStockMovementUseCase(
        stockRepository,
        stockMovementRepository
      ),
      getLowStockCount: new GetLowStockCountUseCase(stockRepository),
      getLowStockItems: new GetLowStockItemsUseCase(stockRepository),
      getExpiringCount: new GetExpiringCountUseCase(
        stockRepository,
        settingsRepository
      ),
      getExpiringBatches: new GetExpiringBatchesUseCase(
        stockRepository,
        settingsRepository
      ),
      adjustStock: new AdjustStockUseCase(stockRepository),
      createOpname: new CreateOpnameUseCase(stockOpnameRepository),
      listOpnames: new ListOpnamesUseCase(stockOpnameRepository),
      getOpnameDetail: new GetOpnameDetailUseCase(stockOpnameRepository),
      updateOpnameItem: new UpdateOpnameItemUseCase(stockOpnameRepository),
      approveOpname: new ApproveOpnameUseCase(stockOpnameRepository),
    },
    settings: {
      listActivePaymentMethods: new ListActivePaymentMethodsUseCase(
        paymentMethodRepository
      ),
      listPaymentMethods: new ListPaymentMethodsUseCase(
        paymentMethodRepository
      ),
      getStoreSettings: new GetStoreSettingsUseCase(settingsRepository),
      updateStoreSettings: new UpdateStoreSettingsUseCase(settingsRepository),
      createPaymentMethod: new CreatePaymentMethodUseCase(
        paymentMethodRepository
      ),
      updatePaymentMethod: new UpdatePaymentMethodUseCase(
        paymentMethodRepository
      ),
      getPricingSettings: new GetPricingSettingsUseCase(settingsRepository),
      updatePricingSettings: new UpdatePricingSettingsUseCase(
        settingsRepository
      ),
      getLoyaltySettings: new GetLoyaltySettingsUseCase(settingsRepository),
      updateLoyaltySettings: new UpdateLoyaltySettingsUseCase(
        settingsRepository
      ),
      getInventorySettings: new GetInventorySettingsUseCase(settingsRepository),
      updateInventorySettings: new UpdateInventorySettingsUseCase(
        settingsRepository
      ),
      listAuditLogs: new ListAuditLogsUseCase(auditRepository),
      listAuditActions: new ListAuditActionsUseCase(auditRepository),
    },
    reporting: {
      getSalesReport: new GetSalesReportUseCase(salesReportRepository),
      getRecentTransactions: new GetRecentTransactionsUseCase(
        salesReportRepository
      ),
      getOperationalReport: new GetOperationalReportUseCase(
        salesReportRepository
      ),
      getStockValuation: new GetStockValuationUseCase(salesReportRepository),
      getProductProfit: new GetProductProfitUseCase(advancedReportRepository),
      getPeriodProfit: new GetPeriodProfitUseCase(advancedReportRepository),
    },
    customers: {
      createCustomer: new CreateCustomerUseCase(customerRepository),
      updateCustomer: new UpdateCustomerUseCase(customerRepository),
      deleteCustomer: new DeleteCustomerUseCase(customerRepository),
      getCustomer: new GetCustomerUseCase(customerRepository),
      listCustomers: new ListCustomersUseCase(customerRepository),
      searchCustomers: new SearchCustomersUseCase(customerRepository),
      getCustomerHistory: new GetCustomerHistoryUseCase(customerRepository),
      listReceivables: new ListReceivablesUseCase(receivableRepository),
      recordReceivablePayment: new RecordReceivablePaymentUseCase(
        receivableRepository,
        customerRepository
      ),
      earnPoints: new EarnPointsUseCase(customerRepository, settingsRepository),
      redeemPoints: new RedeemPointsUseCase(
        customerRepository,
        settingsRepository
      ),
      adjustPoints: new AdjustPointsUseCase(
        loyaltyRepository,
        customerRepository
      ),
      getLoyaltyHistory: new GetLoyaltyHistoryUseCase(loyaltyRepository),
    },
    purchasing: {
      listSuppliers: new ListSuppliersUseCase(supplierRepository),
      createSupplier: new CreateSupplierUseCase(supplierRepository),
      updateSupplier: new UpdateSupplierUseCase(supplierRepository),
      deleteSupplier: new DeleteSupplierUseCase(supplierRepository),
      listPOs: new ListPOsUseCase(purchaseOrderRepository),
      getPO: new GetPOUseCase(purchaseOrderRepository),
      listReceipts: new ListReceiptsUseCase(purchaseOrderRepository),
      listPurchaseReturns: new ListPurchaseReturnsUseCase(
        purchaseOrderRepository
      ),
      listSupplierDebts: new ListSupplierDebtsUseCase(supplierDebtRepository),
      recordSupplierPayment: new RecordSupplierPaymentUseCase(
        supplierDebtRepository
      ),
      createPO: new CreatePOUseCase(purchaseOrderRepository),
      updatePO: new UpdatePOUseCase(purchaseOrderRepository),
      sendPO: new SendPOUseCase(purchaseOrderRepository),
      cancelPO: new CancelPOUseCase(purchaseOrderRepository),
      receiveGoods: new ReceiveGoodsUseCase(purchaseOrderRepository),
      createPurchaseReturn: new CreatePurchaseReturnUseCase(
        purchaseOrderRepository
      ),
    },
    promotions: {
      listPromotions: new ListPromotionsUseCase(promotionRepository),
      getActivePromotions: new GetActivePromotionsUseCase(promotionRepository),
      createPromotion: new CreatePromotionUseCase(promotionRepository),
      updatePromotion: new UpdatePromotionUseCase(promotionRepository),
      togglePromotion: new TogglePromotionUseCase(promotionRepository),
      listVouchers: new ListVouchersUseCase(voucherRepository),
      createVoucher: new CreateVoucherUseCase(voucherRepository),
      toggleVoucher: new ToggleVoucherUseCase(voucherRepository),
      validateVoucher: new ValidateVoucherUseCase(voucherRepository),
    },
    shifts: {
      openShift: new OpenShiftUseCase(shiftRepository),
      getCurrentShift: new GetCurrentShiftUseCase(shiftRepository),
      closeShift: new CloseShiftUseCase(shiftRepository),
      addCashMovement: new AddCashMovementUseCase(shiftRepository),
      getShiftSummary: new GetShiftSummaryUseCase(shiftRepository),
      listShifts: new ListShiftsUseCase(shiftRepository),
    },
    finance: {
      listExpenseCategories: new ListExpenseCategoriesUseCase(
        expenseCategoryRepository
      ),
      createExpenseCategory: new CreateExpenseCategoryUseCase(
        expenseCategoryRepository
      ),
      updateExpenseCategory: new UpdateExpenseCategoryUseCase(
        expenseCategoryRepository
      ),
      deleteExpenseCategory: new DeleteExpenseCategoryUseCase(
        expenseCategoryRepository
      ),
      recordExpense: new RecordExpenseUseCase(
        expenseRepository,
        expenseCategoryRepository
      ),
      listExpenses: new ListExpensesUseCase(expenseRepository),
      updateExpense: new UpdateExpenseUseCase(expenseRepository),
      deleteExpense: new DeleteExpenseUseCase(expenseRepository),
      getCashFlow: new GetCashFlowUseCase(financeReportRepository),
      getProfitLoss: new GetProfitLossUseCase(financeReportRepository),
      getProfitTrend: new GetProfitTrendUseCase(financeReportRepository),
    },
  };
}

/**
 * Convenience helper to instantiate container in Server Actions / Server Components
 */
export async function getAppContainer(): Promise<AppContainer> {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();
  return createContainer(supabase, adminSupabase);
}
