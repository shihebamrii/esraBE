// Import the Content database model from the models folder so we can query database content
const { Content } = require('../models');

// Import the asyncHandler wrapper to automatically handle any errors in async functions and send them to Express error handlers
const asyncHandler = require('../utils/asyncHandler');

// Import the custom AppError class to create clean, structured errors with specific HTTP status codes
const AppError = require('../utils/AppError');

// Define the controller function to fetch a list of content items based on search filters and pagination
const getContents = asyncHandler(async (req, res, _next) => {
  // Construct the base URL of the request using the protocol (http/https) and the server host
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // Extract query filters and pagination settings from the request URL, with default page=1 and limit=20
  const {
    page = 1,
    limit = 20,
    type,
    region,
    theme,
    language,
    rights,
    freeOnly,
    visibility,
    sort = '-createdAt',
  } = req.query;

  // Initialize an empty query object that will hold all our database filter conditions
  const query = {};
  // If visibility is explicitly requested and is not set to 'all', filter by that visibility status
  if (visibility && visibility !== 'all') {
    query.visibility = visibility;
  // If no visibility is specified in the request, default to only returning public content
  } else if (!visibility) {
    query.visibility = 'public';
  }

  // If a content type (like photo, pack, video) filter is requested
  if (type) {
    // If multiple types are specified separated by commas, look for any of these values
    if (type.includes(',')) {
      query.type = { $in: type.split(',') };
    // If it is just a single type, query it directly
    } else {
      query.type = type;
    }
  }
  // If a region filter is provided, add it to our search query (case-insensitive)
  if (region) query.region = { $regex: new RegExp('^' + region + '$', 'i') };
  // If a theme filter is provided, check if it matches any of the content's themes
  if (theme) query.themes = theme;
  // If a language filter is provided, add it to our search query
  if (language) query.language = language;
  // If a rights (license) filter is provided, add it to our search query
  if (rights) query.rights = rights;
  // If freeOnly is set to true, only query for items where the price is 0
  if (freeOnly === 'true') query.price = 0;

  // Query MongoDB to count the total number of documents matching our filters (useful for client-side pagination)
  const total = await Content.countDocuments(query);

  // Retrieve the filtered list of contents, selecting specific fields, populating the creator's name, sorting, and paginating
  const contents = await Content.find(query)
    .select('title type region themes duration thumbnailFileId fileFileId rights price pricePersonal priceCommercial visibility createdAt metadata authors createdBy')
    .populate('createdBy', 'name')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // Iterate over each content item to construct absolute file URLs for the thumbnail and main media files
  const contentsWithUrls = contents.map((content) => {
    // Convert the Mongoose document to a plain JavaScript object so we can add new properties
    const obj = content.toObject();
    // If a thumbnail file ID exists, build the media API URL for the thumbnail
    obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
    // Build the media API URL for retrieving the main content file
    obj.contentUrl = `/api/media/${content.fileFileId}`;
    // Return the updated object
    return obj;
  });

  // Send a successful 200 HTTP response with the results, count, and pagination info back to the client
  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents: contentsWithUrls },
  });
});

// Define the controller function to fetch details of a single content item by its database ID
const getContent = asyncHandler(async (req, res, next) => {
  // Extract the content ID parameter from the request route URL
  const { id } = req.params;
  // Construct the base URL of the request
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Find the content document in the database by its ID and populate the name of the user who created it
  const content = await Content.findById(id)
    .populate('createdBy', 'name');

  // If no content was found matching the given ID, send a 404 Not Found error to the error handler middleware
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // If the content is marked as private, ensure the user has appropriate permissions to view it
  if (content.visibility === 'private') {
    // If the requester is not logged in, deny access with a 403 Forbidden error
    if (!req.user) {
      return next(new AppError('Le contenu est privé !', 403));
    }
    // If the logged-in user is not an administrator AND is not the original creator, deny access
    if (
      req.user.role !== 'admin' &&
      content.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('Le contenu est privé !', 403));
    }
  }

  // Convert the Mongoose document to a plain JavaScript object
  const obj = content.toObject();
  // Build the media API URL for the thumbnail image if it exists
  obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
  // Build the media API URL for downloading or playing the main content file
  obj.contentUrl = `/api/media/${content.fileFileId}`;

  // Send a successful 200 HTTP response containing the single content details
  res.status(200).json({
    status: 'success',
    data: { content: obj },
  });
});

// Define the controller function to fetch related content items based on the current item's characteristics
const getRelatedContent = asyncHandler(async (req, res, next) => {
  // Extract the current content ID parameter from the request route URL
  const { id } = req.params;
  // Extract the search result limit from query parameters, defaulting to 6
  const { limit = 6 } = req.query;

  // Look up the reference content item in the database by its ID
  const content = await Content.findById(id);

  // If the reference content is not found, return a 404 Not Found error
  if (!content) {
    return next(new AppError('Contenu introuvable !', 404));
  }

  // Find up to 'limit' other public contents that share the same type, region, or themes, excluding the current content
  const related = await Content.find({
    _id: { $ne: id },
    visibility: 'public',
    $or: [
      { type: content.type },
      { region: content.region },
      { themes: { $in: content.themes } },
    ],
  })
    .select('title type region thumbnailFileId duration rights price')
    .limit(parseInt(limit, 10));

  // Send a successful 200 HTTP response with the related contents
  res.status(200).json({
    status: 'success',
    data: { related },
  });
});

// Export the controller functions so they can be imported and bound to API routes in other files
module.exports = {
  getContents,
  getContent,
  getRelatedContent,
};
