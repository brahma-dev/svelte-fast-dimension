import MagicString from 'magic-string'
import { parse, walk } from 'svelte/compiler'

const bindingNames = [
  'clientWidth',
  'clientHeight',
  'offsetWidth',
  'offsetHeight'
]
const bindings = bindingNames.map((n) => 'bind:' + n)

/** @type {import('.').fastDimension} */
export function fastDimension() {
  return {
    // @ts-expect-error
    markup({ content, filename }) {
      if (!bindings.some((b) => content.includes(b))) return

      const s = new MagicString(content)
      const ast = parse(content, { filename })

      /** @type {Map<any, string[]>} */
      const elementToCompiledExpressions = new Map()

      walk(ast.html, {
        enter(node, parent) {
          if (node.type === 'Binding' && bindingNames.includes(node.name)) {
            if (!elementToCompiledExpressions.has(parent))
              elementToCompiledExpressions.set(parent, [])

            /** @type {string[]} */
            const expressions = elementToCompiledExpressions.get(parent)
            const boundVar = s.slice(node.expression.start, node.expression.end)
            expressions.push(`${boundVar} = e.target.${node.name}`)
            s.overwrite(node.start, node.end, '')
          }
        }
      })

      const importText =
        'import { resize as ___resize } from "svelte-fast-dimension/action";'
      if (ast.module) {
        // @ts-expect-error
        s.appendLeft(ast.module.content.start, importText)
      } else if (ast.instance) {
        // @ts-expect-error
        s.appendLeft(ast.instance.content.start, importText)
      } else {
        s.append(`<script>${importText}</script>`)
      }

      for (const [el, compiledExpressions] of elementToCompiledExpressions) {
        const finalExpression = compiledExpressions.join('; ')
        s.appendLeft(
          el.attributes[0].start,
          `use:___resize on:fd:resize={(e) => { ${finalExpression} }} `
        )
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true })
      }
    }
  }
}