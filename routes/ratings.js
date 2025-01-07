// routes/ratings.js
router.post('/ratings', async (req, res) => {
    const { rating, bookingId } = req.body;
    // Save rating to database
    res.status(200).json({ message: 'Rating saved' });
  });
  
  // routes/chat.js
  router.post('/messages', async (req, res) => {
    const { message, senderId, receiverId } = req.body;
    // Save message to database
    res.status(200).json({ message: 'Message sent' });
  });
  