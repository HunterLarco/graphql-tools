import fs from 'node:fs/promises';
import path from 'node:path';
import { runTests } from '../../testing/utils.js';
import { gqlPluckFromCodeString, gqlPluckFromCodeStringSync } from '../src/index.js';
import { freeText } from '../src/utils.js';

// A temporary directory unique for each unit test. Cleaned up after each unit
// test resolves.
let tmpDir: string;

beforeEach(async () => {
  // We create temporary directories in the test directory because our test
  // infrastructure denies writes to the host's tmp directory.
  tmpDir = await fs.mkdtemp(path.join(__dirname, 'tmp-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true });
});

describe('graphql-tag-pluck', () => {
  runTests({
    async: gqlPluckFromCodeString,
    sync: gqlPluckFromCodeStringSync,
  })(pluck => {
    it('should allow to pluck without indentation changes', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
        {
          skipIndent: true,
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toMatchSnapshot();
    });

    it('should treat empty results the same', async () => {
      const content = freeText(`
      import gql from 'graphql-tag'

      const doc = gql\`

      \`
    `);
      let sources = await pluck('tmp-XXXXXX.js', content);
      expect(sources.length).toEqual(0);
      sources = await pluck('tmp-XXXXXX.js', content, { skipIndent: true });
      expect(sources.length).toEqual(0);
    });

    it('should pluck graphql-tag template literals from .js file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .js file when it has alias', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import { default as foo } from 'graphql-tag'

        const fragment = foo(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = foo\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
        {
          modules: [
            {
              identifier: 'default',
              name: 'graphql-tag',
            },
          ],
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .js file and remove replacements', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)
        const fragment2 = gql(\`
          fragment Foo2 on FooType {
            name
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
              ...Foo2
            }
          }

          \${fragment}
          \${fragment2}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        fragment Foo2 on FooType {
          name
        }

        query foo {
          foo {
            ...Foo
            ...Foo2
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .ts file that uses `assert` keyword', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        import any from "./package.json" assert { type: "json" };

        const fragment: Document = gql\`
            fragment Foo on FooType {
              id
            }
          \`

          const doc: Document = gql\`
            query foo {
              foo {
                ...Foo
              }
            }

            \${fragment}
          \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it("should pluck graphql template literals from .ts that use an 'as const' assertion", async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import { graphql } from '../somewhere'
        import { Document } from 'graphql'

        const fragment: Document = graphql(\`
            fragment Foo on FooType {
              id
            }
          \`as const)

          const doc: Document = graphql(\`
            query foo {
              foo {
                ...Foo
              }
            }
            \` as const)
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it("should pluck graphql-tag template literals from .ts that use 'using' keyword", async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import { graphql } from '../somewhere'
        import { Document } from 'graphql'
        import createManagedResource from 'managed-resource'

        using managedResource = createManagedResource()

        const fragment: Document = graphql(\`
            fragment Foo on FooType {
              id
            }
          \`)

          const doc: Document = graphql(\`
            query foo {
              foo {
                ...Foo
              }
            }
            \`)
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .ts file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        export namespace Fragments {
          interface EmptyObject {}

          const object = <EmptyObject> {}

          const fragment: Document = gql\`
            fragment Foo on FooType {
              id
            }
          \`

          const doc: Document = gql\`
            query foo {
              foo {
                ...Foo
              }
            }

            \${fragment}
          \`
        }
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .tsx file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.tsx',
        freeText(`
        import * as React from 'react';
        import gql from 'graphql-tag';

        export default class extends React.Component<{}, {}> {
          public render() {
            return <div />;
          }
        }

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query IndexQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue JavaScript file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import Vue from 'vue'
        import gql from 'graphql-tag';

        export default Vue.extend({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue TS/Pug/SCSS file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import Vue from 'vue'
        import gql from 'graphql-tag';

        export default Vue.extend({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });
    it('should pluck graphql-tag template literals from .vue 3 JavaScript file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 TS/Pug/SCSS file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 setup sugar JavaScript file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script setup>
        import gql from 'graphql-tag';


        const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 setup sugar TS/Pug/SCSS file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script lang="ts" setup>
        import gql from 'graphql-tag';

        const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });
    it('should pluck graphql-tag template literals from .vue 3 outside setup sugar JavaScript file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import gql from 'graphql-tag';
        export const pageQuery = gql\`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script setup>
        </script>

        <style>
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 outside setup sugar TS/Pug/SCSS file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import gql from 'graphql-tag';
        export const pageQuery = gql\`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script lang="ts" setup>
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 setup with compiler macros and imports', async () => {
      const EXTERNAL_PROPS_SOURCE = freeText(`
        export type ExternalProps = {
          foo: string;
        };
      `);

      const VUE_SFC_SOURCE = freeText(`
        <template>
          <div>test</div>
        </template>

        <script setup lang="ts">
        import gql from 'graphql-tag';

        const pageQuery = gql\`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        \`;

        import { ExternalProps } from './ExternalProps';
        const props = defineProps<ExternalProps>();
        </script>
      `);

      // We must write the files to disk because this test is specifically
      // ensuring that imports work in Vue SFC files with compiler macros and
      // imports are resolved on disk by the typescript runtime.
      //
      // See https://github.com/ardatan/graphql-tools/pull/7271 for details.
      await fs.writeFile(path.join(tmpDir, 'ExternalProps.ts'), EXTERNAL_PROPS_SOURCE);
      await fs.writeFile(path.join(tmpDir, 'component.vue'), VUE_SFC_SOURCE);

      const sources = await pluck(path.join(tmpDir, 'component.vue'), VUE_SFC_SOURCE);

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 setup JavaScript file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent',
          setup(){
            return {
              pageQuery: gql\`
              query IndexQuery {
                site {
                  siteMetadata {
                    title
                  }
                }
              }
            \`
            }
          }
        })

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .vue 3 setup TS/Pug/SCSS file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent',
          setup(){
            return {
              pageQuery: gql\`
              query IndexQuery {
                site {
                  siteMetadata {
                    title
                  }
                }
              }
            \`
            }
          }
        })

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .svelte file context module', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.svelte',
        freeText(`
        <script context="module" lang="ts">
          import gql from 'graphql-tag';

          let q = gql\`
            query IndexQuery {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .svelte file not context module', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.svelte',
        freeText(`
        <script lang="ts">
          import gql from 'graphql-tag';

          let q = gql\`
            query IndexQuery {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .svelte file with 2 queries', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.svelte',
        freeText(`
        <script lang="ts">
          import gql from 'graphql-tag';

          let q = gql\`
            query IndexQuery {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
          let q2 = gql\`
            query IndexQuery2 {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }

        query IndexQuery2 {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .svelte with 2 scripts tags', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.svelte',
        freeText(`
        <script context="module" lang="ts">
          let q = gql\`
            query IndexQuery {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <script lang="ts">
          import gql from 'graphql-tag';

          let q2 = gql\`
            query IndexQuery2 {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }

        query IndexQuery2 {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .svelte removing comments', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.svelte',
        freeText(`
        <script context="module" lang="ts">
          let q = gql\`
            query IndexQuery {
              site {
                siteMetadata {
                  title
                }
              }
            }
          \`;
        </script>

        <script lang="ts">
          import gql from 'graphql-tag';

          // let q2 = gql\`
          //   query IndexQuery2 {
          //     site {
          //       siteMetadata {
          //         title
          //       }
          //     }
          //   }
          // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .astro file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.astro',
        freeText(`
        ---
        import gql from 'graphql-tag';

        let q = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;
        ---

        <div>foo</div>
        `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        `),
      );
    });

    it('should pluck graphql-tag template literals from .astro file with 2 queries', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.astro',
        freeText(`
        ---
        import gql from 'graphql-tag';

        let q = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;
        let q2 = gql\`
          query IndexQuery2 {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;
        ---

        <div>foo</div>
        `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }

        query IndexQuery2 {
          site {
            siteMetadata {
              title
            }
          }
        }
        `),
      );
    });

    it('should pluck graphql-tag template literals from .astro removing comments', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.astro',
        freeText(`
        ---
        import gql from 'graphql-tag';

        let q = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // let q2 = gql\`
        //   query IndexQuery2 {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        ---

        <div>foo</div>
        `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        `),
      );
    });

    it('should pluck graphql-tag template literals from .tsx file with generic jsx elements', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.tsx',
        freeText(`
        import * as React from 'react';
        import gql from 'graphql-tag';
        import Generic from './Generic.js'

        export default class extends React.Component<{}, {}> {
          public render() {
            return (
              <div>
                <Generic<string, number> />
                <Generic<undefined> />
                <Generic<null> />
              </div>
            )
          }
        }

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .ts file with the same const inside namespace and outside namespace', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        import gql from 'graphql-tag';

        namespace Foo {
          export const foo = 12;

          export const query = gql\`
            query myQueryInNamespace {
              fieldA
            }
          \`;
        }

        interface ModuleWithProviders {
          ngModule: string;
        }

        export class FooModule {
          static forRoot() {
            return <ModuleWithProviders>{
              ngModule: 'foo',
              value: Foo.foo
            };
          }
        }

        export const query = gql\`
          query myQuery {
            fieldA
          }
        \`;
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query myQueryInNamespace {
          fieldA
        }

        query myQuery {
          fieldA
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .flow file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.flow',
        freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .js file with @flow header', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        // @flow

        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .js file with @flow strict-local', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        // @flow strict-local

        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should NOT pluck graphql-tag template literals from .js file without a @flow header', async () => {
      const fail = Error('Function did not throw');

      try {
        await pluck(
          'tmp-XXXXXX.js',
          freeText(`
          import gql from 'graphql-tag'
          import { Document } from 'graphql'

          const fragment: Document = gql\`
            fragment Foo on FooType {
              id
            }
          \`

          const doc: Document = gql\`
            query foo {
              foo {
                ...Foo
              }
            }

            \${fragment}
          \`
        `),
        );

        throw fail;
      } catch (e) {
        expect(e).not.toEqual(fail);
      }
    });

    it('should pluck graphql-tag template literals from .flow.jsx file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.flow.jsx',
        freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from .*.jsx file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.mutation.jsx',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals leaded by a magic comment from .js file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        const Message = /* GraphQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `),
      );
    });

    it('should pluck graphql-tag expression statements leaded by a magic comment from .js file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        /* GraphQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `),
      );
    });

    it(`should NOT pluck other template literals from a .js file`, async () => {
      const sources = await pluck(
        `tmp-XXXXXX.js`,
        freeText(`
        test(
          \`test1\`
        )
        test.test(
          \`test2\`
        )
        test\`
          test3
        \`
        test.test\`
          test4
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual('');
    });

    it('should pluck template literals when graphql-tag is imported differently', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import graphqltag from 'graphql-tag'

        const fragment = graphqltag(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = graphqltag\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck template literals from gql by default even if not imported from graphql-tag', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from code string', async () => {
      const sources = await pluck(
        'test.js',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from code string with /* GraphQL */ comment', async () => {
      const sources = await pluck(
        'test.js',
        freeText(`
        import gql from 'graphql-tag'

        const doc = gql(/* GraphQL */ \`
          query foo {
            foo {
              foo
            }
          }
        \`)
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query foo {
          foo {
            foo
          }
        }
      `),
      );
    });

    it('should pluck graphql-tag template literals from a .js file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should be able to specify the global GraphQL identifier name', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        const fragment = anothergql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = anothergql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
        {
          globalGqlIdentifierName: 'anothergql',
        },
      );
      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should be able to specify the global GraphQL identifier name case sensitively', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        const fragment = anotherGql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = AnotherGql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
        {
          globalGqlIdentifierName: 'anotherGql',
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }`),
      );
    });

    it('should be able to specify the GraphQL magic comment to look for', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        const Message = /* GQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `),
        {
          gqlMagicComment: 'GQL',
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `),
      );
    });

    it('should be able to specify a custom Vue block to pluck from', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.vue',
        freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent',
          setup(){
            return {
              pageQuery: gql\`
              query IndexQuery {
                site {
                  siteMetadata {
                    title
                  }
                }
              }
            \`
            }
          }
        })

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>

        <graphql lang="gql">
        query CustomBlockQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        </graphql>
      `),
        {
          gqlVueBlock: 'graphql',
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }

        query CustomBlockQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `),
      );
    });

    it('should be able to specify the package name of which the GraphQL identifier should be imported from', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import mygql from 'my-graphql-tag'

        const fragment = mygql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = mygql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
        {
          modules: [{ name: 'my-graphql-tag' }],
        },
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck graphql template literal from gatsby package', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import {graphql} from 'gatsby'

        const fragment = graphql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = graphql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck gql template literal from apollo-server-express package', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import { gql } from 'apollo-server-express'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck gql template literal from @apollo/client package', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        import { gql } from '@apollo/client'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `),
      );
    });

    it('should pluck magic comment template literals with a trailing semicolon', async () => {
      const sources = await pluck('test.js', '/* GraphQL */ `{}`;');
      expect(sources.map(source => source.body).join('\n\n')).toEqual('{}');
    });

    it('should pluck with comments having escaped backticks', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
      import gql from 'graphql-tag';

      export default gql\`
        type User {
          id: ID!
          "Choose a nice username, so users can \\\`@mention\\\` you."
          username: String!
          email: String!
        }
      \`
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
          type User {
            id: ID!
            "Choose a nice username, so users can \`@mention\` you."
            username: String!
            email: String!
          }
      `),
      );
    });

    it('should pluck graphql template literal imported lazily', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.js',
        freeText(`
        async function getUserType() {
          const graphql = await import('graphql-tag');

          return graphql\`
            type User {
              id: ID!
              "Choose a nice username, so users can \\\`@mention\\\` you."
              username: String!
              email: String!
            }
          \`
        }
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
          type User {
            id: ID!
            "Choose a nice username, so users can \`@mention\` you."
            username: String!
            email: String!
          }
      `),
      );
    });

    it('should pluck graphql template literal in a code file that has decorators', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.ts',
        freeText(`
        const CurrentUserForProfile = gql\`
          query CurrentUserForProfile {
            currentUser {
              login
              avatar_url
            }
          }
        \`;

        @Component({
          selector: 'app-dialog',
          template: 'test',
        })
        export class DialogComponent implements OnInit {
          constructor(
            public apollo: Apollo,
            @Inject(MAT_DIALOG_DATA) public data: any
          ) {}

          ngOnInit(): void {
            this.apollo
              .watchQuery<any>({
                query: CurrentUserForProfile,
              })
              .valueChanges.subscribe();
          }
        }
      `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(/* GraphQL */ `
          query CurrentUserForProfile {
            currentUser {
              login
              avatar_url
            }
          }
        `),
      );
    });

    it('should pluck graphql-tag template literals using the custom `isGqlTemplateLiteral` hook', async () => {
      const query = freeText(`#graphql
        query queryName {
          id
        }
      `);
      const fileContent = `export const query = \`${query}\`;`;
      const fileName = 'tmp-HOOKS1.ts';

      // Default behavior: ignores in-query comments
      let sources = await pluck(fileName, fileContent);
      expect(sources.map(source => source.body).join('\n\n')).toEqual('');

      // Custom behavior: recognizes in-query comments
      sources = await pluck(fileName, fileContent, {
        isGqlTemplateLiteral: node => {
          return (
            node.type === 'TemplateLiteral' &&
            /\s*#graphql\s*\n/i.test(node.quasis[0]?.value?.raw || '')
          );
        },
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(query);
    });

    it('should pluck graphql-tag template literals using the custom `pluckStringFromFile` hook', async () => {
      const query = freeText(`
        query queryName { id }
        \${ANOTHER_VARIABLE}
      `);
      const fileContent = `export const query = /* GraphQL */ \`${query}\`;`;
      const fileName = 'tmp-HOOKS2.ts';

      // Default behavior: removes expressions
      let sources = await pluck(fileName, fileContent);
      expect(sources.map(source => source.body).join('\n\n')).toEqual('query queryName { id }');

      // Custom behavior: keeps expressions as comments
      sources = await pluck(fileName, fileContent, {
        pluckStringFromFile: (code, { start, end }) => {
          return (
            code
              .slice(start! + 1, end! - 1)
              // Annotate embedded expressions
              // e.g. ${foo} -> #EXPRESSION:foo
              .replace(/\$\{([^}]*)\}/g, (_, m1) => '#EXPRESSION:' + m1)
              .split('\\`')
              .join('`')
          );
        },
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        'query queryName { id }\n#EXPRESSION:ANOTHER_VARIABLE',
      );
    });

    it('should pluck graphql-tag template literals from .gts file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.gts',
        freeText(`
    import Component from '@glimmer/component';
    import graphql from 'graphql-tag';

    const UpdateCreditCardMutationDocument = graphql(\`
      mutation updateCreditCard($input: UpdateCreditCardInput!) {
        updateCreditCard(input: $input) {
          __typename
        }
      }
    \`);


    export default class PaymentDetailsPage extends Component<unknown> {
      updateCreditCardMutation = async (): Promise<void> => {
        return await new Promise((resolve) => resolve());
      }

      onSubmit = async (): Promise<void> => {
        return this.updateCreditCardMutation();
      }

      <template>
        <div>
          <h1>Update Payment Details</h1>
          <p data-test-existing-payment-method>{{this.paymentMethodText}}</p>
          <button {{on "click" this.onSubmit}}>Submit</button>
        </div>
      </template>
    }
    `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
    mutation updateCreditCard($input: UpdateCreditCardInput!) {
      updateCreditCard(input: $input) {
        __typename
      }
    }
  `),
      );
    });

    it('should pluck graphql-tag template literals from .gjs file', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.gjs',
        freeText(`
    import Component from '@glimmer/component';
    import graphql from 'graphql-tag';

    const UpdateCreditCardMutationDocument = graphql(\`
      mutation updateCreditCard($input: UpdateCreditCardInput!) {
        updateCreditCard(input: $input) {
          __typename
        }
      }
    \`);


    export default class PaymentDetailsPage extends Component<unknown> {
      updateCreditCardMutation = async (): Promise<void> => {
        return await new Promise((resolve) => resolve());
      }

      onSubmit = async (): Promise<void> => {
        return this.updateCreditCardMutation();
      }

      <template>
        <div>
          <h1>Update Payment Details</h1>
          <p data-test-existing-payment-method>{{this.paymentMethodText}}</p>
          <button {{on "click" this.onSubmit}}>Submit</button>
        </div>
      </template>
    }
    `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
    mutation updateCreditCard($input: UpdateCreditCardInput!) {
      updateCreditCard(input: $input) {
        __typename
      }
    }
  `),
      );
    });

    it('should pluck graphql-tag template literals from .gts file with 2 queries', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.gts',
        freeText(`
    import Component from '@glimmer/component';
    import graphql from 'graphql-tag'

    const UpdateCreditCardMutationDocument = graphql(\`
      mutation updateCreditCard($input: UpdateCreditCardInput!) {
        updateCreditCard(input: $input) {
          __typename
        }
      }
    \`);

    const UpdatePaypalMutationDocument = graphql(\`
      mutation updatePaypal($input: UpdatePaypalInput!) {
        updatePaypal(input: $input) {
          __typename
        }
      }
    \`);


    export default class PaymentDetailsPage extends Component<unknown> {
      updateCreditCardMutation = async (): Promise<void> => {
        return await new Promise((resolve) => resolve());
      }

      onSubmit = async (): Promise<void> => {
        return this.updateCreditCardMutation();
      }

      <template>
        <div>
          <h1>Update Payment Details</h1>
          <p data-test-existing-payment-method>{{this.paymentMethodText}}</p>
          <button {{on "click" this.onSubmit}}>Submit</button>
        </div>
      </template>
    }
    `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
    mutation updateCreditCard($input: UpdateCreditCardInput!) {
      updateCreditCard(input: $input) {
        __typename
      }
    }

    mutation updatePaypal($input: UpdatePaypalInput!) {
      updatePaypal(input: $input) {
        __typename
      }
    }
  `),
      );
    });

    it('should pluck graphql-tag template literals from .gts file with multiple queries in different function signatures', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.gts',
        freeText(`
    import Component from '@glimmer/component';
    import graphql from 'graphql-tag'

    const UpdateCreditCardMutationDocument = graphql(\`
      mutation updateCreditCard($input: UpdateCreditCardInput!) {
        updateCreditCard(input: $input) {
          __typename
        }
      }
    \`);

    export function anotherQuery() {
      const UpdatePaypalMutationDocument = graphql(\`
        mutation updatePaypal($input: UpdatePaypalInput!) {
          updatePaypal(input: $input) {
            __typename
          }
        }
    \`);
    }

    export default class PaymentDetailsPage extends Component<unknown> {
      updateCreditCardMutation = async (): Promise<void> => {
        return await new Promise((resolve) => resolve());
      }

      onSubmit = async (): Promise<void> => {
        return this.updateCreditCardMutation();
      }

      <template>
        <div>
          <h1>Update Payment Details</h1>
          <p data-test-existing-payment-method>{{this.paymentMethodText}}</p>
          <button {{on "click" this.onSubmit}}>Submit</button>
        </div>
      </template>
    }
    `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
    mutation updateCreditCard($input: UpdateCreditCardInput!) {
      updateCreditCard(input: $input) {
        __typename
      }
    }

    mutation updatePaypal($input: UpdatePaypalInput!) {
      updatePaypal(input: $input) {
        __typename
      }
    }
  `),
      );
    });

    it('should pluck graphql-tag template literals from .gts file, ignoring comments', async () => {
      const sources = await pluck(
        'tmp-XXXXXX.gts',
        freeText(`
    import Component from '@glimmer/component';
    import graphql from 'graphql-tag'

    const UpdateCreditCardMutationDocument = graphql(\`
      mutation updateCreditCard($input: UpdateCreditCardInput!) {
        updateCreditCard(input: $input) {
          __typename
        }
      }
    \`);

    // const UpdatePaypalMutationDocument = graphql(\`
    // mutation updatePaypal($input: UpdatePaypalInput!) {
    //    updatePaypal(input: $input) {
    //      __typename
    //    }
    //  }
    // \`);


    export default class PaymentDetailsPage extends Component<unknown> {
      updateCreditCardMutation = async (): Promise<void> => {
        return await new Promise((resolve) => resolve());
      }

      onSubmit = async (): Promise<void> => {
        return this.updateCreditCardMutation();
      }

      <template>
        <div>
          <h1>Update Payment Details</h1>
          <p data-test-existing-payment-method>{{this.paymentMethodText}}</p>
          <button {{on "click" this.onSubmit}}>Submit</button>
        </div>
      </template>
    }
    `),
      );

      expect(sources.map(source => source.body).join('\n\n')).toEqual(
        freeText(`
    mutation updateCreditCard($input: UpdateCreditCardInput!) {
      updateCreditCard(input: $input) {
        __typename
      }
    }
  `),
      );
    });
  });
});
