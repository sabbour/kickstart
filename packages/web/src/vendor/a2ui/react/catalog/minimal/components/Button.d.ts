/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { z } from 'zod';
export declare const ButtonSchema: z.ZodObject<{
    child: any;
    action: any;
    variant: z.ZodOptional<z.ZodEnum<["primary", "borderless"]>>;
}, "strip", z.ZodTypeAny, {
    [x: string]: any;
    child?: unknown;
    action?: unknown;
    variant?: unknown;
}, {
    [x: string]: any;
    child?: unknown;
    action?: unknown;
    variant?: unknown;
}>;
export declare const ButtonApiDef: {
    name: string;
    schema: z.ZodObject<{
        child: any;
        action: any;
        variant: z.ZodOptional<z.ZodEnum<["primary", "borderless"]>>;
    }, "strip", z.ZodTypeAny, {
        [x: string]: any;
        child?: unknown;
        action?: unknown;
        variant?: unknown;
    }, {
        [x: string]: any;
        child?: unknown;
        action?: unknown;
        variant?: unknown;
    }>;
};
export declare const Button: any;
//# sourceMappingURL=Button.d.ts.map