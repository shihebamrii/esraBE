const fs = require('fs');

const completeCollection = JSON.parse(fs.readFileSync('./mediatheque_complete_postman.json', 'utf8'));

function findItemByName(name, items = completeCollection.item) {
    for (let i of items) {
        if (i.name === name) return i;
        if (i.item) {
            let found = findItemByName(name, i.item);
            if (found) return found;
        }
    }
    return null;
}

const sprint1Items = [
    findItemByName("Register"),
    findItemByName("Login"),
    findItemByName("Get Me"),
    findItemByName("Refresh Token"),
    findItemByName("List Users"),
    findItemByName("Update User Status"),
    findItemByName("Update User"),
    findItemByName("Delete User")
].filter(Boolean);

const sprint2Items = [
    // Contents
    findItemByName("List Contents"),
    findItemByName("Get Content"),
    findItemByName("Upload Content"),
    findItemByName("List Content"),
    findItemByName("Update Content"),
    findItemByName("Approve Content"),
    findItemByName("Delete Content"),
    // Uploads (Photos too)
    findItemByName("Upload Photo"),
    findItemByName("List Photos"),
    findItemByName("Get Photo"),
    findItemByName("Get Preview (Watermarked)"),
    findItemByName("Approve Photo"),
    findItemByName("Delete Photo"),
    // Packs
    findItemByName("List Packs"),
    findItemByName("Get Pack"),
    findItemByName("Create Pack"),
    findItemByName("List Admin Packs"),
    findItemByName("Update Pack"),
    findItemByName("Delete Pack")
].filter(Boolean);

const sprint3Items = [
    // Favorites
    findItemByName("Get Favorites"),
    findItemByName("Toggle Favorite"),
    // Playlists
    findItemByName("List Playlists"),
    findItemByName("Get Playlist"),
    findItemByName("Create Playlist"),
    findItemByName("List Admin Playlists"),
    findItemByName("Delete Playlist"),
    // Cart
    findItemByName("Add to Cart"),
    findItemByName("Get Cart"),
    findItemByName("Clear Cart"),
    // Orders / Checkout
    findItemByName("Create Order"),
    findItemByName("Get My Orders"),
    findItemByName("Get Order"),
    findItemByName("Mock Complete Payment"),
    findItemByName("Check Payment Status")
].filter(Boolean);

const sprint4Items = [
    // Downloads
    findItemByName("Get Downloads"),
    findItemByName("Track Download"),
    // Contact Messages
    findItemByName("Submit Inquiry"),
    findItemByName("List Inquiries"),
    findItemByName("Respond to Inquiry"),
    findItemByName("Delete Inquiry"),
    // Statistics
    findItemByName("Get Stats"),
    findItemByName("Get User Stats"),
    findItemByName("Get Admin Stats"),
    findItemByName("Get Recent Activity"),
    // AI Analysis
    findItemByName("Analyze Photo (AI)"),
    findItemByName("Chat Photo (AI)")
].filter(Boolean);

const newCollection = {
    info: {
        name: "Sprint Collection",
        description: "Postman collection structured by Sprints for the Médiathèque API.",
        schema: completeCollection.info.schema
    },
    variable: completeCollection.variable, // This ensures all environment variables are correctly linked.
    item: [
        {
            name: "Sprint 1: l’inscription, l’authentification, le profil et les utilisateurs",
            item: sprint1Items
        },
        {
            name: "Sprint 2: Gérer les contenus, les téléversements et les packs",
            item: sprint2Items
        },
        {
            name: "Sprint 3: Gérer les favoris, la langue, les playlists, le panier, les commandes",
            item: sprint3Items
        },
        {
            name: "Sprint 4: Gérer les téléchargements, les messages de contact, les statistiques et l’analyse IA",
            item: sprint4Items
        }
    ]
};

fs.writeFileSync('./sprint_collection.json', JSON.stringify(newCollection, null, 2));
console.log("Successfully generated sprint_collection.json");
