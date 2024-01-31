import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Bleed,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { request } from "http";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

const createProduct = async (request) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        input: {
          title: `${color} Snowboard`,
          variants: [{ price: Math.random() * 100 }],
        },
      },
    }
  );
  const responseJson = await response.json();

  return json({
    product: responseJson.data.productCreate.product,
  });
};

const updateProduct = async (request) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.formData();
  const productId = body.get("id");
  const variantId = body.get("variantId");
  const productPrice = body.get("price");
  const namespace = body.get("namespace");
  const key = body.get("key");
  const type = body.get("type");
  const value = body.get("value");
  const response = await admin.graphql(
    `#graphql
       mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              title
              inventoryPolicy
              inventoryQuantity
              price
              compareAtPrice
            }
            userErrors {
              field
              message
            }
          }
        }`,
    {
      variables: {
        input: {
          id: variantId,
          price: productPrice,
        },
      },
    }
  );
  console.log("Namespace:", namespace);
  console.log("Key:", key);
  console.log("Type:", type);
  console.log("Value:", value);
  if (
    namespace === undefined ||
    key === undefined ||
    type === undefined ||
    value === undefined
  ) {
    console.log("price updated only");
    return json({
      status: response.status,
      updated: response.status === 200 ? true : false,
    });
  }
  const metafield = await admin.graphql(
    `#graphql
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
    {
      variables: {
        definition: {
          name: namespace,
          namespace: namespace,
          key: key,
          type: type,
          ownerType: "PRODUCT",
        },
      },
    }
  );
  const metafieldData = await metafield.json();
  const definition =
    metafieldData?.data.metafieldDefinitionCreate.createdDefinition?.id;

  const metafieldId = definition?.replace("Definition", "");
  const res = await admin.graphql(
    `#graphql
      mutation updateProductMetafields($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            metafields(first: 3) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
          }
          userErrors {
            message
            field
          }
        }
      }`,
    {
      variables: {
        input: {
          metafields: [
            {
              id: metafieldId,
              value: value,
            },
          ],
          id: productId,
        },
      },
    }
  );
  return json({
    status: res.status,
    updated: res.status === 200 ? true : false,
  });
};

export const action = async ({ request }) => {
  switch (request.method) {
    case "POST":
      return await createProduct(request);
    case "PUT":
      return await updateProduct(request);
    default:
      return json({});
  }
};

export default function Index() {
  const nav = useNavigation();
  const actionData = useActionData();
  const submit = useSubmit();
  const [selectedProduct, setSelectedProduct] = useState();
  const [openEdit, setOpenEdit] = useState(false);
  const [price, setPrice] = useState();
  const [metafield, setMetafield] = useState(null);
  const isLoading =
    ["loading", "submitting"].includes(nav.state) && nav.formMethod === "POST";
  const productId = actionData?.product?.id.replace(
    "gid://shopify/Product/",
    ""
  );
  const updated = actionData?.updated;

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
    if (updated) {
      shopify.toast.show("Product Updated Succesfully");
      setOpenEdit(false);
    }
  }, [productId, updated]);
  const generateProduct = () => submit({}, { replace: true, method: "POST" });
  const updateProduct = () => {
    const formData = new FormData();
    formData.set("price", price);
    formData.set("id", selectedProduct.productId);
    formData.set("variantId", selectedProduct.productVariantId);
    formData.set("namespace", metafield?.namespace);
    formData.set("key", metafield?.key);
    formData.set("type", metafield?.type);
    formData.set("value", metafield?.value);
    submit(formData, { method: "PUT" });
  };
  const searchProduct = async () => {
    const products = await shopify.resourcePicker({ type: "product" });
    if (products) {
      const { images, id, variants, title, handle } = products[0];

      setSelectedProduct({
        ...selectedProduct,
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc,
      });
    }
  };

  return (
    <Page>
      <ui-title-bar title="Remix app template">
        <button variant="primary" onClick={generateProduct}>
          Generate a product
        </button>
      </ui-title-bar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Card>
                  <BlockStack gap="500">
                    <InlineStack align="space-between">
                      <Text as={"h2"} variant="headingLg">
                        Product
                      </Text>
                      {selectedProduct?.productId ? (
                        <Button variant="plain" onClick={searchProduct}>
                          Change product
                        </Button>
                      ) : null}
                    </InlineStack>
                    {selectedProduct?.productId ? (
                      <InlineStack blockAlign="center" gap="500">
                        <Text
                          as="span"
                          variant="headingMd"
                          fontWeight="semibold"
                        >
                          {selectedProduct.productTitle}
                        </Text>
                      </InlineStack>
                    ) : (
                      <BlockStack gap="200">
                        <Button onClick={searchProduct} id="select-product">
                          Select product
                        </Button>
                      </BlockStack>
                    )}
                    <Bleed marginInlineStart="200" marginInlineEnd="200">
                      <Divider />
                    </Bleed>
                    {selectedProduct?.productId && (
                    <Button
                      onClick={() => setOpenEdit(true)}
                      id="select-product"
                    >
                      Edit product
                    </Button>
                    )}
                    {openEdit && (
                      <Form action="/events" method="post">
                        <label for="price">Price</label>
                        <br />
                        <input
                          name="price"
                          type="number"
                          onChange={(e) => setPrice(e.target.value)}
                        />
                        <br/>
                        <br/>
                        <label for="metafield">Metafield:</label>
                        <br />
                        <InlineStack gap="400">
                          <InlineStack  gap="200">
                            <label for="metafield">Name: </label>
                            <input
                              name="metafield"
                              type="text"
                              onChange={(e) =>
                                setMetafield({
                                  ...metafield,
                                  namespace: e.target.value,
                                })
                              }
                            />
                          </InlineStack>
                          <InlineStack  gap="200">
                            <label for="metafield">Key: </label>
                            <input
                              name="metafield"
                              type="text"
                              onChange={(e) =>
                                setMetafield({
                                  ...metafield,
                                  key: e.target.value,
                                })
                              }
                            />
                          </InlineStack>
                        </InlineStack>

                        <br />
                        <InlineStack gap="400">
                          <InlineStack gap="200">
                          <label for="metafield">Type: </label>
                        <select
                          id="metafieldType"
                          name="metafieldType"
                          onChange={(e) =>
                            setMetafield({ ...metafield, type: e.target.value })
                          }
                        >
                          <option value="">Select a metafield type</option>
                          <option value="multi_line_text_field">
                            multi_line_text_field
                          </option>
                          <option value="single_line_text_field">
                            single_line_text_field
                          </option>
                          <option value="boolean">boolean</option>
                        </select>
                          </InlineStack>
                          <InlineStack gap="200">
                          <label for="metafield">Value: </label>
                        <input
                          name="metafield"
                          type="text"
                          onChange={(e) =>
                            setMetafield({
                              ...metafield,
                              value: e.target.value,
                            })
                          }
                        />
                          </InlineStack>
                        </InlineStack>
                        <br/>
                        <Button onClick={updateProduct}>Save</Button>
                      </Form>
                    )}
                    <InlineStack
                      gap="500"
                      align="space-between"
                      blockAlign="start"
                    ></InlineStack>
                  </BlockStack>
                </Card>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={generateProduct}>
                    Generate a product
                  </Button>
                  {actionData?.product && (
                    <Button
                      url={`shopify:admin/products/${productId}`}
                      target="_blank"
                      variant="plain"
                    >
                      View product
                    </Button>
                  )}
                </InlineStack>
                {actionData?.product && (
                  <Box
                    padding="400"
                    background="bg-surface-active"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                    overflowX="scroll"
                  >
                    <pre style={{ margin: 0 }}>
                      <code>{JSON.stringify(actionData.product, null, 2)}</code>
                    </pre>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App template specs
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Framework
                      </Text>
                      <Link
                        url="https://remix.run"
                        target="_blank"
                        removeUnderline
                      >
                        Remix
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Database
                      </Text>
                      <Link
                        url="https://www.prisma.io/"
                        target="_blank"
                        removeUnderline
                      >
                        Prisma
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Interface
                      </Text>
                      <span>
                        <Link
                          url="https://polaris.shopify.com"
                          target="_blank"
                          removeUnderline
                        >
                          Polaris
                        </Link>
                        {", "}
                        <Link
                          url="https://shopify.dev/docs/apps/tools/app-bridge"
                          target="_blank"
                          removeUnderline
                        >
                          App Bridge
                        </Link>
                      </span>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        API
                      </Text>
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql"
                        target="_blank"
                        removeUnderline
                      >
                        GraphQL API
                      </Link>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Next steps
                  </Text>
                  <List>
                    <List.Item>
                      Build an{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/getting-started/build-app-example"
                        target="_blank"
                        removeUnderline
                      >
                        {" "}
                        example app
                      </Link>{" "}
                      to get started
                    </List.Item>
                    <List.Item>
                      Explore Shopify’s API with{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
                        target="_blank"
                        removeUnderline
                      >
                        GraphiQL
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
