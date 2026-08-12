import { actions } from 'astro:actions';

import type { ValidCreatePostInput } from '@/lib/admin-posts';
export const callCreatePost = (input: ValidCreatePostInput) => actions.admin.createPost(input);
