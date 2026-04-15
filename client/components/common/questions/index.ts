/**
 * Reusable Question Components
 *
 * A collection of accessible, animated question input components
 * for assessments, forms, and settings throughout the app.
 *
 * @example
 * import { SliderInput, EmojiScale, SingleSelect, NumberInput } from "@/components/common/questions";
 *
 * <SliderInput value={5} onChange={setValue} min={1} max={10} />
 * <EmojiScale value={selected} onChange={setSelected} options={[...]} />
 * <SingleSelect value={selected} onChange={setSelected} options={[...]} />
 * <NumberInput value={weight} onChange={setWeight} unit="kg" />
 */

// Components
export { SliderInput } from "./SliderInput";
export { EmojiScale } from "./EmojiScale";
export { SingleSelect } from "./SingleSelect";
export { NumberInput } from "./NumberInput";

// Types
export type {
  BaseQuestionProps,
  SliderInputProps,
  EmojiScaleProps,
  EmojiScaleOption,
  SingleSelectProps,
  SingleSelectOption,
  NumberInputProps,
  MultiSelectProps,
} from "./types";
