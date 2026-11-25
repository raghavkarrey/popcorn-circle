import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRatingsRepository } from '@/lib/ratings';

export const ratingsRepository = createRatingsRepository(AsyncStorage);
