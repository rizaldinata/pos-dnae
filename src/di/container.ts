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

// Catalog module dependencies
import { SupabasePriceTierRepository } from "@/modules/catalog/infrastructure/supabase-price-tier.repository";
import { SupabaseProductRepository } from "@/modules/catalog/infrastructure/supabase-product.repository";
import {
  SupabaseBrandRepository,
  SupabaseCategoryRepository,
  SupabaseUnitRepository,
} from "@/modules/catalog/infrastructure/supabase-master-data.repository";
import { CreateProductUseCase } from "@/modules/catalog/application/use-cases/create-product.use-case";
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
  AdjustStockUseCase,
  ApproveOpnameUseCase,
  CreateOpnameUseCase,
  GetOpnameDetailUseCase,
  ListOpnamesUseCase,
  UpdateOpnameItemUseCase,
} from "@/modules/inventory/application/use-cases/opname.use-cases";
import { SupabaseStockOpnameRepository } from "@/modules/inventory/infrastructure/supabase-stock-opname.repository";

// Settings module dependencies
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

// Reporting module dependencies
import { SupabaseSalesReportRepository } from "@/modules/reporting/infrastructure/supabase-sales-report.repository";
import {
  GetSalesReportUseCase,
  GetRecentTransactionsUseCase,
} from "@/modules/reporting/application/use-cases/get-sales-report.use-case";

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
  };
  inventory: {
    getStock: GetStockUseCase;
    listStockOverview: ListStockOverviewUseCase;
    getStockCard: GetStockCardUseCase;
    recordStockMovement: RecordStockMovementUseCase;
    getLowStockCount: GetLowStockCountUseCase;
    getLowStockItems: GetLowStockItemsUseCase;
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
  };
  reporting: {
    getSalesReport: GetSalesReportUseCase;
    getRecentTransactions: GetRecentTransactionsUseCase;
  };
  customers: {
    createCustomer: CreateCustomerUseCase;
    updateCustomer: UpdateCustomerUseCase;
    deleteCustomer: DeleteCustomerUseCase;
    getCustomer: GetCustomerUseCase;
    listCustomers: ListCustomersUseCase;
    searchCustomers: SearchCustomersUseCase;
    getCustomerHistory: GetCustomerHistoryUseCase;
  };
  shifts: {
    openShift: OpenShiftUseCase;
    getCurrentShift: GetCurrentShiftUseCase;
    closeShift: CloseShiftUseCase;
    addCashMovement: AddCashMovementUseCase;
    getShiftSummary: GetShiftSummaryUseCase;
    listShifts: ListShiftsUseCase;
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
  const authService = new SupabaseAuthService(supabase);

  // 2. Use Cases
  const productRepository = new SupabaseProductRepository(supabase);
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
  const shiftRepository = new SupabaseShiftRepository(supabase);
  const customerRepository = new SupabaseCustomerRepository(supabase);

  return {
    sales: {
      checkout: new CheckoutUseCase(
        saleRepository,
        productRepository,
        stockRepository,
        shiftRepository,
        priceTierRepository,
        settingsRepository
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
    },
    reporting: {
      getSalesReport: new GetSalesReportUseCase(salesReportRepository),
      getRecentTransactions: new GetRecentTransactionsUseCase(
        salesReportRepository
      ),
    },
    customers: {
      createCustomer: new CreateCustomerUseCase(customerRepository),
      updateCustomer: new UpdateCustomerUseCase(customerRepository),
      deleteCustomer: new DeleteCustomerUseCase(customerRepository),
      getCustomer: new GetCustomerUseCase(customerRepository),
      listCustomers: new ListCustomersUseCase(customerRepository),
      searchCustomers: new SearchCustomersUseCase(customerRepository),
      getCustomerHistory: new GetCustomerHistoryUseCase(customerRepository),
    },
    shifts: {
      openShift: new OpenShiftUseCase(shiftRepository),
      getCurrentShift: new GetCurrentShiftUseCase(shiftRepository),
      closeShift: new CloseShiftUseCase(shiftRepository),
      addCashMovement: new AddCashMovementUseCase(shiftRepository),
      getShiftSummary: new GetShiftSummaryUseCase(shiftRepository),
      listShifts: new ListShiftsUseCase(shiftRepository),
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
