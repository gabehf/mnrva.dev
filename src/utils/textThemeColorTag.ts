import theme from '@/data/theme'
import { MAP_COLOR_VARIANT_TO_TEXT } from "./mapVariants";

export default function textThemeColorTag() {
    return MAP_COLOR_VARIANT_TO_TEXT[theme.colors.primary]
}
