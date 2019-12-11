export class RecommendationManager {
    private static instance: RecommendationManager;

    private constructor() {
        //
    }
    static getInstance(): RecommendationManager {
        if (!RecommendationManager.instance) {
            RecommendationManager.instance = new RecommendationManager();
        }

        return RecommendationManager.instance;
    }
}
